-- 天衍统计用的表和汇总函数（CloudBase PostgreSQL）
-- 部署：tcb db execute --sql "$(cat cloudfunctions/schema.sql)"
-- 可以重复执行，已有的表和数据不会动。

-- 起卦记录（logReading 写入）
create table if not exists public.readings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  bin char(6) not null,
  gua text not null default '',
  changing smallint[] not null default '{}',
  change_bin char(6),
  change_gua text not null default '',
  method text not null default 'coin',
  source text not null default '',
  uid text not null default '',
  site text not null default '',
  ua text not null default ''
);
create index if not exists readings_created_at_idx on public.readings (created_at desc);

-- 访问记录：每打开一次页面一条（logReading 写入）
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ref text not null default '',
  source text not null default '',
  uid text not null default '',
  site text not null default '',
  ua text not null default ''
);
create index if not exists visits_created_at_idx on public.visits (created_at desc);

-- 开 RLS、不加策略：网页端匿名身份读写不了，只有云函数能碰
alter table public.readings enable row level security;
alter table public.visits enable row level security;

-- 后台页用的汇总。按北京时间分天；days 是往前看几天（含今天）
-- prev 是紧挨着的上一段：同样长、同样截到这个钟点，后台拿它和这一段比（多了是阳爻，少了是阴爻）
create or replace function public.admin_stats(days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
  bounds as (
    select (date_trunc('day', now() at time zone 'Asia/Shanghai') - make_interval(days => greatest(least(days, 365), 1) - 1)) as start_local,
           date_trunc('day', now() at time zone 'Asia/Shanghai') as today_local,
           make_interval(days => greatest(least(days, 365), 1)) as span
  ),
  pv as (
    select uid from visits, bounds
    where created_at >= ((bounds.start_local - bounds.span) at time zone 'Asia/Shanghai') and created_at < now() - bounds.span
  ),
  pr as (
    select uid from readings, bounds
    where created_at >= ((bounds.start_local - bounds.span) at time zone 'Asia/Shanghai') and created_at < now() - bounds.span
  ),
  v as (
    select created_at at time zone 'Asia/Shanghai' as t, uid, source, ref, ua
    from visits, bounds where created_at >= (bounds.start_local at time zone 'Asia/Shanghai')
  ),
  r as (
    select created_at at time zone 'Asia/Shanghai' as t, uid, source, gua, change_gua, changing, method
    from readings, bounds where created_at >= (bounds.start_local at time zone 'Asia/Shanghai')
  ),
  day_list as (
    select generate_series(bounds.start_local, bounds.today_local, interval '1 day')::date as d from bounds
  ),
  daily as (
    select d,
      (select count(*) from v where v.t::date = d) as visits,
      (select count(distinct uid) from v where v.t::date = d) as visitors,
      (select count(*) from r where r.t::date = d) as readings,
      (select count(distinct uid) from r where r.t::date = d) as readers
    from day_list
  )
select jsonb_build_object(
  'generatedAt', now(),
  'days', (select count(*) from day_list),
  'today', (select jsonb_build_object('visits', visits, 'visitors', visitors, 'readings', readings, 'readers', readers)
            from daily order by d desc limit 1),
  'total', jsonb_build_object(
      'visits', (select count(*) from v),
      'visitors', (select count(distinct uid) from v),
      'readings', (select count(*) from r),
      'readers', (select count(distinct uid) from r)),
  'prev', jsonb_build_object(
      'visits', (select count(*) from pv),
      'visitors', (select count(distinct uid) from pv),
      'readings', (select count(*) from pr),
      'readers', (select count(distinct uid) from pr)),
  'allTime', jsonb_build_object(
      'visits', (select count(*) from visits),
      'readings', (select count(*) from readings)),
  'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', d, 'visits', visits, 'visitors', visitors,
            'readings', readings, 'readers', readers) order by d), '[]') from daily),
  'hexagrams', (select coalesce(jsonb_agg(x order by (x->>'count')::int desc, x->>'gua'), '[]') from
            (select jsonb_build_object('gua', gua, 'count', count(*)) x from r group by gua) s),
  'methods', (select coalesce(jsonb_agg(jsonb_build_object('method', method, 'count', c) order by c desc), '[]') from
            (select method, count(*) c from r group by method) s),
  'changing', (select coalesce(jsonb_agg(jsonb_build_object('n', n, 'count', c) order by n), '[]') from
            (select cardinality(changing) n, count(*) c from r group by 1) s),
  'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', src, 'visits', vc, 'visitors', vu, 'readings', rc) order by vc desc, rc desc), '[]') from
            (select src, sum(vc) vc, sum(vu) vu, sum(rc) rc from (
               select coalesce(nullif(source, ''), case when ref <> '' then 'ref:' || ref else '' end) src, count(*) vc, count(distinct uid) vu, 0 rc from v group by 1
               union all
               select source, 0, 0, count(*) from r where source <> '' group by 1
             ) u group by src) s),
  'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'visits', (select count(*) from v where extract(hour from v.t) = h),
            'readings', (select count(*) from r where extract(hour from r.t) = h)) order by h), '[]')
            from generate_series(0, 23) h),
  'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', dev, 'count', c) order by c desc), '[]') from
            (select case when ua ~* '(iphone|android|mobile|harmonyos)' then 'mobile' else 'desktop' end dev, count(*) c from v group by 1) s),
  'recent', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') from
            (select jsonb_build_object('at', to_char(t, 'MM-DD HH24:MI'), 'gua', gua, 'changeGua', change_gua,
                     'changing', cardinality(changing), 'method', method, 'source', source) x
             from r order by t desc limit 15) s)
);
$$;

-- 只给云函数用的服务角色执行权限
revoke all on function public.admin_stats(int) from public;
revoke all on function public.admin_stats(int) from anon, authenticated;
grant execute on function public.admin_stats(int) to service_role;
