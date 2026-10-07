-- =====================================================================
--  PANDA DEL AMOR — Base de datos (Supabase / PostgreSQL)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
--  Se puede ejecutar más de una vez (no rompe nada).
--
--  Antes: Authentication → Sign In / Providers → activar "Anonymous sign-ins".
-- =====================================================================

-- ---------------------------------------------------------------------
--  TABLAS
-- ---------------------------------------------------------------------

-- Una pareja = un panda compartido
create table if not exists public.parejas (
  id      uuid primary key default gen_random_uuid(),
  codigo  text not null unique,              -- código de 6 letras para unirse
  creada  timestamptz not null default now()
);

-- Las dos personas de la pareja (lugar 1 y lugar 2)
create table if not exists public.miembros (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  pareja_id       uuid not null references public.parejas (id) on delete cascade,
  lugar           smallint not null check (lugar in (1, 2)), -- define qué key de Gemini usa
  nombre          text not null check (char_length(nombre) between 1 and 30),
  clave_hash      text not null,             -- clave de recuperación (sha256)
  compartir_auto  boolean not null default false, -- compartir ubicación sin preguntar
  ultimo_dia      date,                      -- último día que hizo algo de amor (para la racha)
  caricias_hoy    int not null default 0,
  mensajes_hoy    int not null default 0,
  dia_contadores  date,
  unido           timestamptz not null default now(),
  unique (pareja_id, lugar)
);

-- El panda
create table if not exists public.mascotas (
  pareja_id               uuid primary key references public.parejas (id) on delete cascade,
  nombre                  text not null default 'Pandi' check (char_length(nombre) between 1 and 20),
  amor                    int  not null default 0,     -- puntos totales (nunca bajan): lo hacen crecer
  racha                   int  not null default 0,     -- días seguidos en que AMBOS lo cuidaron
  mejor_racha             int  not null default 0,
  racha_dia               date,                        -- último día que sumó racha
  ultima_comida           timestamptz not null default now() - interval '6 hours', -- nace con hambre
  ultima_caricia          timestamptz not null default now(),
  comidas_total           int  not null default 0,
  caricias_total          int  not null default 0,
  frases_total            int  not null default 0,
  animo                   text not null default 'feliz', -- lo decide Gemini leyendo sus mensajes
  animo_nota              text,
  mensajes_sin_analizar   int  not null default 0,
  frase_dia               text,
  frase_fecha             date,
  nacio                   timestamptz not null default now(),
  actualizada             timestamptz not null default now()
);

-- Todo lo que pasa: comidas, caricias, frases, mensajes, avisos
create table if not exists public.eventos (
  id         bigint generated always as identity primary key,
  pareja_id  uuid not null references public.parejas (id) on delete cascade,
  de         uuid not null,
  tipo       text not null check (tipo in
             ('comida','caricia','frase','mensaje','necesito_amor','pedir_ubicacion','ubicacion','sistema')),
  texto      text check (texto is null or char_length(texto) <= 500),
  favorito   boolean not null default false,   -- los favoritos nunca se borran
  creado     timestamptz not null default now()
);
create index if not exists eventos_pareja_fecha on public.eventos (pareja_id, creado desc);

-- Última ubicación compartida de cada persona (se pisa: no se guarda historial)
create table if not exists public.ubicaciones (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  pareja_id    uuid not null references public.parejas (id) on delete cascade,
  lat          double precision not null,
  lng          double precision not null,
  precision_m  int,
  actualizada  timestamptz not null default now()
);

-- Cuántas veces usó Gemini cada persona por día (para no pasarse del plan gratis)
create table if not exists public.uso_gemini (
  user_id   uuid not null references auth.users (id) on delete cascade,
  dia       date not null,
  llamadas  int  not null default 0,
  primary key (user_id, dia)
);

-- ---------------------------------------------------------------------
--  REGLAS DEL JUEGO (mantener igual que web/js/reglas.js)
-- ---------------------------------------------------------------------
--  comida:   +5 amor (como máximo 1 cada 2 h; si no, "está lleno")
--  caricia:  +2 amor (hasta 15 por persona por día)
--  frase:    +8 amor (frase dedicada al otro)
--  mensaje:  +3 amor (hasta 15 por persona por día)
--  racha:    el día cuenta cuando LOS DOS hicieron algo de amor.
--            Cada día de racha suma 10 + 2 × racha (máx. 40) de amor extra.
--  etapas:   0 bebé · 300 cachorrito · 1200 pequeño · 3000 juguetón · 6000 grande · 10000 panda sabio
-- ---------------------------------------------------------------------

create or replace function public.hoy() returns date
language sql stable as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

-- La pareja del usuario actual (security definer: evita recursión en las políticas)
create or replace function public.mi_pareja() returns uuid
language sql stable security definer set search_path = public as $$
  select pareja_id from public.miembros where user_id = auth.uid()
$$;

create or replace function public.codigo_aleatorio(largo int) returns text
language plpgsql volatile as $$
declare
  letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin 0/O ni 1/I
  r text := '';
begin
  for i in 1..largo loop
    r := r || substr(letras, 1 + floor(random() * length(letras))::int, 1);
  end loop;
  return r;
end $$;

create or replace function public.hash_clave(clave text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(upper(trim(clave)), 'UTF8')), 'hex')
$$;

-- Estado completo para la app
create or replace function public.mi_estado() returns json
language plpgsql stable security definer set search_path = public as $$
declare p uuid := public.mi_pareja();
begin
  if p is null then return json_build_object('pareja', null); end if;
  return json_build_object(
    'pareja',   (select json_build_object('id', id, 'codigo', codigo) from public.parejas where id = p),
    'yo',       (select json_build_object('id', user_id, 'nombre', nombre, 'lugar', lugar, 'compartir_auto', compartir_auto)
                   from public.miembros where user_id = auth.uid()),
    'otro',     (select json_build_object('id', user_id, 'nombre', nombre, 'lugar', lugar)
                   from public.miembros where pareja_id = p and user_id <> auth.uid()),
    'mascota',  (select row_to_json(m) from public.mascotas m where pareja_id = p),
    'hoy',      public.hoy()
  );
end $$;

-- Crear pareja nueva (lo hace el primero)
create or replace function public.crear_pareja(mi_nombre text, nombre_panda text default 'Pandi') returns json
language plpgsql security definer set search_path = public as $$
declare
  p uuid; cod text; clave text := public.codigo_aleatorio(8);
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from public.miembros where user_id = auth.uid()) then
    raise exception 'Ya estás en una pareja';
  end if;
  loop
    cod := public.codigo_aleatorio(6);
    exit when not exists (select 1 from public.parejas where codigo = cod);
  end loop;
  insert into public.parejas (codigo) values (cod) returning id into p;
  insert into public.miembros (user_id, pareja_id, lugar, nombre, clave_hash)
    values (auth.uid(), p, 1, trim(mi_nombre), public.hash_clave(clave));
  insert into public.mascotas (pareja_id, nombre) values (p, coalesce(nullif(trim(nombre_panda), ''), 'Pandi'));
  insert into public.eventos (pareja_id, de, tipo, texto) values (p, auth.uid(), 'sistema', 'nacio');
  return json_build_object('codigo', cod, 'clave', clave);
end $$;

-- Unirse con el código (lo hace el segundo)
create or replace function public.unirse_pareja(codigo_pareja text, mi_nombre text) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid; clave text := public.codigo_aleatorio(8);
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if exists (select 1 from public.miembros where user_id = auth.uid()) then
    raise exception 'Ya estás en una pareja';
  end if;
  select id into p from public.parejas where codigo = upper(trim(codigo_pareja));
  if p is null then raise exception 'Código incorrecto'; end if;
  if (select count(*) from public.miembros where pareja_id = p) >= 2 then
    raise exception 'Esa pareja ya está completa';
  end if;
  insert into public.miembros (user_id, pareja_id, lugar, nombre, clave_hash)
    values (auth.uid(), p, 2, trim(mi_nombre), public.hash_clave(clave));
  return json_build_object('codigo', upper(trim(codigo_pareja)), 'clave', clave);
end $$;

-- Recuperar tu lugar si cambiaste de celular o se borraron los datos
create or replace function public.recuperar_lugar(codigo_pareja text, clave text) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid; viejo uuid;
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  select id into p from public.parejas where codigo = upper(trim(codigo_pareja));
  select user_id into viejo from public.miembros
    where pareja_id = p and clave_hash = public.hash_clave(clave);
  if viejo is null then raise exception 'Código o clave incorrectos'; end if;
  if viejo = auth.uid() then return json_build_object('ok', true); end if;
  delete from public.miembros where user_id = auth.uid(); -- por si estaba en otra
  update public.miembros  set user_id = auth.uid() where user_id = viejo;
  update public.eventos   set de = auth.uid()      where de = viejo and pareja_id = p;
  update public.ubicaciones set user_id = auth.uid() where user_id = viejo;
  delete from public.uso_gemini where user_id = viejo;
  return json_build_object('ok', true);
end $$;

-- La acción principal: alimentar, acariciar, mandar frases, mensajes y avisos
create or replace function public.registrar_accion(tipo_accion text, texto_accion text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  yo public.miembros;
  m  public.mascotas;
  d  date := public.hoy();
  suma int := 0;
  extra int := 0;
  nota text := null;
  ev bigint;
  analizar boolean := false;
  es_amor boolean := tipo_accion in ('comida','caricia','frase','mensaje');
begin
  select * into yo from public.miembros where user_id = auth.uid() for update;
  if not found then raise exception 'No estás en una pareja'; end if;
  if tipo_accion not in ('comida','caricia','frase','mensaje','necesito_amor','pedir_ubicacion') then
    raise exception 'Acción desconocida: %', tipo_accion;
  end if;
  if tipo_accion in ('frase','mensaje') and coalesce(trim(texto_accion), '') = '' then
    raise exception 'Falta el texto';
  end if;

  select * into m from public.mascotas where pareja_id = yo.pareja_id for update;

  -- contadores diarios por persona
  if yo.dia_contadores is distinct from d then
    yo.caricias_hoy := 0; yo.mensajes_hoy := 0; yo.dia_contadores := d;
  end if;

  if tipo_accion = 'comida' then
    if now() - m.ultima_comida < interval '2 hours' then
      nota := 'lleno';
    else
      suma := 5;
    end if;
    m.ultima_comida := now(); m.comidas_total := m.comidas_total + 1;
  elsif tipo_accion = 'caricia' then
    yo.caricias_hoy := yo.caricias_hoy + 1;
    if yo.caricias_hoy <= 15 then suma := 2; else nota := 'tope_caricias'; end if;
    m.ultima_caricia := now(); m.caricias_total := m.caricias_total + 1;
  elsif tipo_accion = 'frase' then
    suma := 8; m.frases_total := m.frases_total + 1;
    m.mensajes_sin_analizar := m.mensajes_sin_analizar + 1;
  elsif tipo_accion = 'mensaje' then
    yo.mensajes_hoy := yo.mensajes_hoy + 1;
    if yo.mensajes_hoy <= 15 then suma := 3; end if;
    m.mensajes_sin_analizar := m.mensajes_sin_analizar + 1;
  end if;

  -- racha: el día cuenta cuando los dos hicieron algo de amor
  if es_amor then
    yo.ultimo_dia := d;
    if m.racha_dia is distinct from d
       and (select count(*) from public.miembros where pareja_id = yo.pareja_id) = 2
       and not exists (select 1 from public.miembros
                        where pareja_id = yo.pareja_id and user_id <> yo.user_id
                          and ultimo_dia is distinct from d) then
      m.racha := case when m.racha_dia = d - 1 then m.racha + 1 else 1 end;
      m.racha_dia := d;
      m.mejor_racha := greatest(m.mejor_racha, m.racha);
      extra := least(40, 10 + 2 * m.racha);
      nota := coalesce(nota, 'racha');
    end if;
  end if;

  m.amor := m.amor + suma + extra;
  if m.mensajes_sin_analizar >= 8 then analizar := true; end if;
  m.actualizada := now();

  update public.miembros set ultimo_dia = yo.ultimo_dia, caricias_hoy = yo.caricias_hoy,
         mensajes_hoy = yo.mensajes_hoy, dia_contadores = yo.dia_contadores
   where user_id = yo.user_id;
  update public.mascotas set amor = m.amor, racha = m.racha, mejor_racha = m.mejor_racha,
         racha_dia = m.racha_dia, ultima_comida = m.ultima_comida, ultima_caricia = m.ultima_caricia,
         comidas_total = m.comidas_total, caricias_total = m.caricias_total, frases_total = m.frases_total,
         mensajes_sin_analizar = m.mensajes_sin_analizar, actualizada = m.actualizada
   where pareja_id = m.pareja_id;

  insert into public.eventos (pareja_id, de, tipo, texto)
    values (yo.pareja_id, yo.user_id, tipo_accion, nullif(trim(texto_accion), ''))
    returning id into ev;

  return json_build_object('evento', ev, 'sumo', suma, 'extra', extra, 'nota', nota,
                           'analizar', analizar, 'amor', m.amor, 'racha', m.racha);
end $$;

-- Compartir mi ubicación (solo la ve mi pareja; se guarda solo la última)
create or replace function public.compartir_ubicacion(la double precision, ln double precision, prec int default null) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja();
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  insert into public.ubicaciones (user_id, pareja_id, lat, lng, precision_m, actualizada)
    values (auth.uid(), p, la, ln, prec, now())
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng,
    precision_m = excluded.precision_m, actualizada = now(), pareja_id = excluded.pareja_id;
  insert into public.eventos (pareja_id, de, tipo) values (p, auth.uid(), 'ubicacion');
  return json_build_object('ok', true);
end $$;

create or replace function public.ajustes(mi_nombre text default null, nombre_panda text default null,
                                          auto_ubicacion boolean default null) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja();
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  update public.miembros set
    nombre = coalesce(nullif(trim(mi_nombre), ''), nombre),
    compartir_auto = coalesce(auto_ubicacion, compartir_auto)
  where user_id = auth.uid();
  if nullif(trim(nombre_panda), '') is not null then
    update public.mascotas set nombre = trim(nombre_panda) where pareja_id = p;
  end if;
  return public.mi_estado();
end $$;

create or replace function public.marcar_favorito(evento_id bigint, valor boolean) returns void
language sql security definer set search_path = public as $$
  update public.eventos set favorito = valor where id = evento_id and pareja_id = public.mi_pareja();
$$;

create or replace function public.salir_de_pareja() returns void
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja();
begin
  delete from public.miembros where user_id = auth.uid();
  delete from public.ubicaciones where user_id = auth.uid();
  if p is not null and not exists (select 1 from public.miembros where pareja_id = p) then
    delete from public.parejas where id = p; -- borra panda y eventos en cascada
  end if;
end $$;

-- ---------------------------------------------------------------------
--  GEMINI: contador de uso diario (lo llama el servidor de Vercel)
-- ---------------------------------------------------------------------
create or replace function public.usar_gemini(limite int) returns json
language plpgsql security definer set search_path = public as $$
declare yo public.miembros; usadas int;
begin
  select * into yo from public.miembros where user_id = auth.uid();
  if not found then raise exception 'No estás en una pareja'; end if;
  insert into public.uso_gemini (user_id, dia, llamadas) values (auth.uid(), public.hoy(), 0)
    on conflict do nothing;
  update public.uso_gemini set llamadas = llamadas + 1
   where user_id = auth.uid() and dia = public.hoy() and llamadas < limite
   returning llamadas into usadas;
  if usadas is null then
    select llamadas into usadas from public.uso_gemini where user_id = auth.uid() and dia = public.hoy();
    return json_build_object('ok', false, 'usadas', usadas, 'limite', limite, 'lugar', yo.lugar);
  end if;
  return json_build_object('ok', true, 'usadas', usadas, 'limite', limite, 'lugar', yo.lugar);
end $$;

create or replace function public.mi_uso_gemini() returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select llamadas from public.uso_gemini where user_id = auth.uid() and dia = public.hoy()), 0)
$$;

create or replace function public.guardar_animo(nuevo_animo text, nota text) returns void
language sql security definer set search_path = public as $$
  update public.mascotas
     set animo = case when nuevo_animo in ('feliz','enamorado','mimoso','extrana','triste','preocupado','juguetón')
                      then nuevo_animo else animo end,
         animo_nota = left(nota, 200), mensajes_sin_analizar = 0, actualizada = now()
   where pareja_id = public.mi_pareja();
$$;

create or replace function public.guardar_frase_dia(frase text) returns void
language sql security definer set search_path = public as $$
  update public.mascotas set frase_dia = left(frase, 300), frase_fecha = public.hoy()
   where pareja_id = public.mi_pareja();
$$;

-- ---------------------------------------------------------------------
--  MANTENIMIENTO: limpieza para que la base gratis (500 MB) dure años
-- ---------------------------------------------------------------------
--  · Borra eventos de más de 180 días (salvo favoritos y frases)
--  · Borra frases de más de 2 años (salvo favoritas)
--  · Borra el contador de Gemini de más de 30 días
--  · Si la base pasa los 400 MB, borra los eventos más viejos (no favoritos)
create or replace function public.mantenimiento() returns json
language plpgsql security definer set search_path = public as $$
declare borrados int := 0; n int; tam bigint;
begin
  delete from public.eventos where favorito = false and tipo <> 'frase' and creado < now() - interval '180 days';
  get diagnostics n = row_count; borrados := borrados + n;
  delete from public.eventos where favorito = false and tipo = 'frase' and creado < now() - interval '2 years';
  get diagnostics n = row_count; borrados := borrados + n;
  delete from public.uso_gemini where dia < public.hoy() - 30;
  delete from public.parejas p where not exists (select 1 from public.miembros m where m.pareja_id = p.id)
     and p.creada < now() - interval '1 day';

  tam := pg_database_size(current_database());
  if tam > 400 * 1024 * 1024 then
    delete from public.eventos where id in (
      select id from public.eventos where favorito = false
       order by creado asc limit greatest(1000, (select count(*) / 5 from public.eventos)));
    get diagnostics n = row_count; borrados := borrados + n;
  end if;
  return json_build_object('borrados', borrados, 'tam_mb', round(tam / 1048576.0, 1),
                           'eventos', (select count(*) from public.eventos));
end $$;

create or replace function public.ping() returns timestamptz
language sql stable as $$ select now() $$;

-- ---------------------------------------------------------------------
--  SEGURIDAD (Row Level Security): cada pareja ve solo lo suyo
-- ---------------------------------------------------------------------
alter table public.parejas     enable row level security;
alter table public.miembros    enable row level security;
alter table public.mascotas    enable row level security;
alter table public.eventos     enable row level security;
alter table public.ubicaciones enable row level security;
alter table public.uso_gemini  enable row level security;

drop policy if exists "ver mi pareja"       on public.parejas;
drop policy if exists "ver miembros"        on public.miembros;
drop policy if exists "ver mi panda"        on public.mascotas;
drop policy if exists "ver eventos"         on public.eventos;
drop policy if exists "ver ubicaciones"     on public.ubicaciones;
drop policy if exists "ver mi uso"          on public.uso_gemini;

create policy "ver mi pareja"   on public.parejas     for select to authenticated using (id = public.mi_pareja());
create policy "ver miembros"    on public.miembros    for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver mi panda"    on public.mascotas    for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver eventos"     on public.eventos     for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver ubicaciones" on public.ubicaciones for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver mi uso"      on public.uso_gemini  for select to authenticated using (user_id = auth.uid());
-- No hay políticas de insert/update/delete: todo se modifica con las funciones de arriba.

-- La clave de recuperación no se expone: solo se pueden leer estas columnas
revoke all on public.miembros from anon, authenticated;
grant select (user_id, pareja_id, lugar, nombre, compartir_auto, ultimo_dia, unido) on public.miembros to authenticated;

-- Quién puede llamar a cada función
revoke execute on all functions in schema public from public, anon;
grant execute on function public.ping()                                   to anon, authenticated;
grant execute on function public.mantenimiento()                          to anon, authenticated;
grant execute on function public.hoy()                                    to authenticated;
grant execute on function public.mi_pareja()                              to authenticated;
grant execute on function public.mi_estado()                              to authenticated;
grant execute on function public.crear_pareja(text, text)                 to authenticated;
grant execute on function public.unirse_pareja(text, text)                to authenticated;
grant execute on function public.recuperar_lugar(text, text)              to authenticated;
grant execute on function public.registrar_accion(text, text)             to authenticated;
grant execute on function public.compartir_ubicacion(double precision, double precision, int) to authenticated;
grant execute on function public.ajustes(text, text, boolean)             to authenticated;
grant execute on function public.marcar_favorito(bigint, boolean)         to authenticated;
grant execute on function public.salir_de_pareja()                        to authenticated;
grant execute on function public.usar_gemini(int)                         to authenticated;
grant execute on function public.mi_uso_gemini()                          to authenticated;
grant execute on function public.guardar_animo(text, text)                to authenticated;
grant execute on function public.guardar_frase_dia(text)                  to authenticated;

-- ---------------------------------------------------------------------
--  TIEMPO REAL: avisos instantáneos entre los dos celulares
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.eventos;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.mascotas; exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
--  LIMPIEZA AUTOMÁTICA DIARIA (4 AM Argentina = 7 UTC)
--  Si pg_cron no está disponible no pasa nada: Vercel también la ejecuta.
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('panda-limpieza') where exists (select 1 from cron.job where jobname = 'panda-limpieza');
  perform cron.schedule('panda-limpieza', '0 7 * * *', 'select public.mantenimiento()');
exception when others then
  raise notice 'pg_cron no disponible: la limpieza la hace Vercel (api/mantenimiento).';
end $$;
