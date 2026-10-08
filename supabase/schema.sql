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
--  AGREGADOS v2 (estilo Pou): cuidados, monedas, tienda, fotos, abandono
--  Con "add column if not exists" se puede re-ejecutar sin perder nada.
-- ---------------------------------------------------------------------
alter table public.mascotas add column if not exists monedas        int not null default 50;
alter table public.mascotas add column if not exists ultimo_banio   timestamptz not null default now();
alter table public.mascotas add column if not exists durmiendo      boolean not null default false;
alter table public.mascotas add column if not exists energia_base   int not null default 100;   -- energía en "energia_desde"
alter table public.mascotas add column if not exists energia_desde  timestamptz not null default now();
alter table public.mascotas add column if not exists inventario     jsonb not null default '{"manzana": 2}'::jsonb; -- heladera
alter table public.mascotas add column if not exists accesorios     jsonb not null default '[]'::jsonb; -- comprados
alter table public.mascotas add column if not exists puestos        jsonb not null default '[]'::jsonb; -- los que tiene puestos
alter table public.mascotas add column if not exists ultimo_cuidado timestamptz not null default now();
alter table public.mascotas add column if not exists aviso_abandono int not null default 0;     -- 0 nada · 1 primer aviso · 2 último aviso
alter table public.mascotas add column if not exists se_fue         timestamptz;                -- si no lo cuidan 7 días, se va
alter table public.mascotas add column if not exists generacion     int not null default 1;     -- cuántos pandas tuvieron
alter table public.mascotas add column if not exists banios_total   int not null default 0;
alter table public.mascotas add column if not exists juegos_total   int not null default 0;

alter table public.miembros add column if not exists juegos_hoy int not null default 0;
alter table public.miembros add column if not exists sentir_hoy int not null default 0;

alter table public.eventos add column if not exists ref bigint;

-- v3: calendario de la pareja, frase y pregunta del día sin repetir, ubicación en vivo
alter table public.parejas   add column if not exists fecha_inicio date;                -- cuando empezaron
alter table public.parejas   add column if not exists fechas jsonb not null default '[]'; -- [{titulo, fecha:'AAAA-MM-DD', emoji}]
alter table public.mascotas  add column if not exists pregunta_dia text;
alter table public.mascotas  add column if not exists frases_previas text[] not null default '{}';
alter table public.mascotas  add column if not exists preguntas_previas text[] not null default '{}';  -- para las fotos: id en public.fotos
alter table public.eventos drop constraint if exists eventos_tipo_check;
alter table public.eventos add constraint eventos_tipo_check check (tipo in
  ('comida','caricia','frase','mensaje','necesito_amor','pedir_ubicacion','ubicacion','sistema',
   'banio','dormir','despertar','comer','juego','sentir','pregunta','foto','compra','desafio','alerta','llegue'));

-- Fotos que se mandan (comprimidas en el celular, ~100 KB). Se borran a los 120 días salvo las guardadas con 💖.
create table if not exists public.fotos (
  id         bigint generated always as identity primary key,
  pareja_id  uuid not null references public.parejas (id) on delete cascade,
  de         uuid not null,
  datos      text not null check (char_length(datos) <= 450000), -- "data:image/jpeg;base64,..."
  creado     timestamptz not null default now()
);
create index if not exists fotos_pareja_fecha on public.fotos (pareja_id, creado desc);

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
--
--  v2 (estilo Pou):
--  banio:     +4 amor (si no se bañó en las últimas 3 h; si no, "ya está limpito")
--  dormir:    +2 amor si tenía menos de 70 de energía. Durmiendo recupera 25 de energía por hora;
--             despierto pierde 6 por hora. Durmiendo no se puede comer, bañar ni jugar.
--  comer:     una comida de la heladera (ver item_info). No come si comió hace menos de 2 h.
--  juego:     +3 amor y monedas = puntaje / 3 (máx. 20), hasta 5 juegos con premio por persona por día.
--             Cuesta 10 de energía y necesita al menos 10.
--  sentir:    "¿cómo estás?" (triste, te extraño...): +3 amor, hasta 5 por persona por día.
--  pregunta:  respuesta a la pregunta del día: +5 amor (una por persona por día).
--  foto:      +5 amor (las 3 primeras del día). Máximo 10 fotos por persona por día.
--  racha:     además del amor, cada día de racha da +5 monedas.
--  desafíos:  3 por persona por día (1 "de pareja" + 2 "de cuidado"); regalo diario de 10 monedas.
--  abandono:  días sin que nadie lo cuide → 3: primer aviso · 5: último aviso · 7: se va.
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
    'pareja',   (select json_build_object('id', id, 'codigo', codigo, 'fecha_inicio', fecha_inicio, 'fechas', fechas) from public.parejas where id = p),
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

-- Catálogo de la tienda (mantener igual que TIENDA en web/js/reglas.js)
--  comida:    precio en monedas · horas de panza llena · amor · energía extra · si da cariño
--  accesorio: precio · lugar (uno por lugar: cabeza, cara, cuello)
create or replace function public.item_info(item text) returns jsonb
language sql immutable as $$
  select (case item
    when 'manzana'     then '{"tipo":"comida","precio":8,"horas":4,"amor":1,"energia":0}'
    when 'zanahoria'   then '{"tipo":"comida","precio":6,"horas":3,"amor":1,"energia":0}'
    when 'leche'       then '{"tipo":"comida","precio":10,"horas":3,"amor":1,"energia":15}'
    when 'te'          then '{"tipo":"comida","precio":12,"horas":2,"amor":1,"energia":25}'
    when 'helado'      then '{"tipo":"comida","precio":15,"horas":3,"amor":2,"energia":0,"carino":true}'
    when 'dumpling'    then '{"tipo":"comida","precio":18,"horas":7,"amor":2,"energia":0}'
    when 'sushi'       then '{"tipo":"comida","precio":22,"horas":8,"amor":3,"energia":0}'
    when 'torta'       then '{"tipo":"comida","precio":30,"horas":6,"amor":5,"energia":0,"carino":true}'
    when 'mono'        then '{"tipo":"accesorio","precio":40,"lugar":"cabeza"}'
    when 'flor'        then '{"tipo":"accesorio","precio":35,"lugar":"cabeza"}'
    when 'gorro'       then '{"tipo":"accesorio","precio":60,"lugar":"cabeza"}'
    when 'auriculares' then '{"tipo":"accesorio","precio":90,"lugar":"cabeza"}'
    when 'corona'      then '{"tipo":"accesorio","precio":150,"lugar":"cabeza"}'
    when 'lentes'      then '{"tipo":"accesorio","precio":80,"lugar":"cara"}'
    when 'bufanda'     then '{"tipo":"accesorio","precio":70,"lugar":"cuello"}'
    when 'pajarita'    then '{"tipo":"accesorio","precio":50,"lugar":"cuello"}'
  end)::jsonb
$$;

-- Energía ahora (0..100): durmiendo sube 25 por hora, despierto baja 8 por hora (igual que Reglas.energia)
create or replace function public.energia_actual(base int, desde timestamptz, dormido boolean) returns int
language sql stable as $$
  select case when dormido
    then least(100, base + floor(extract(epoch from now() - desde) / 3600 * 25))::int
    else greatest(0, base - floor(extract(epoch from now() - desde) / 3600 * 8))::int end
$$;

-- Comienzo del día de hoy (hora argentina)
create or replace function public.inicio_hoy() returns timestamptz
language sql stable as $$
  select (public.hoy()::timestamp at time zone 'America/Argentina/Buenos_Aires')
$$;

-- La acción principal: alimentar, acariciar, mandar frases, mensajes, avisos y los cuidados nuevos
create or replace function public.registrar_accion(tipo_accion text, texto_accion text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  yo public.miembros;
  m  public.mascotas;
  d  date := public.hoy();
  suma int := 0;
  extra int := 0;
  ganadas int := 0;
  nota text := null;
  ev bigint;
  analizar boolean := false;
  es_amor boolean := tipo_accion in ('comida','caricia','frase','mensaje','banio','dormir','comer','juego','sentir','pregunta','foto');
  en int;
  info jsonb;
  cant int;
  puntaje int;
  texto_ev text := nullif(trim(texto_accion), '');
  ref_foto bigint := nullif(current_setting('panda.ref', true), '')::bigint;
  fila json;
begin
  select * into yo from public.miembros where user_id = auth.uid() for update;
  if not found then raise exception 'No estás en una pareja'; end if;
  if tipo_accion not in ('comida','caricia','frase','mensaje','necesito_amor','pedir_ubicacion',
                         'banio','dormir','despertar','comer','juego','sentir','pregunta','foto','alerta','llegue') then
    raise exception 'Acción desconocida: %', tipo_accion;
  end if;
  if tipo_accion in ('frase','mensaje','sentir','pregunta','comer','juego') and texto_ev is null then
    raise exception 'Falta el texto';
  end if;
  if tipo_accion = 'foto' and ref_foto is null then raise exception 'Las fotos se mandan con enviar_foto'; end if;
  -- alerta en broma: "¿estás con otra mujer?" / "¿estás con otro hombre?" (no suma amor)
  if tipo_accion = 'alerta' and coalesce(texto_ev, '') not in ('mujer', 'hombre') then raise exception 'Alerta inválida'; end if;
  -- "¡Llegué, amor!": el texto es el lugar (opcional, ej. "a casa")
  if tipo_accion = 'llegue' then texto_ev := left(texto_ev, 40); end if;

  select * into m from public.mascotas where pareja_id = yo.pareja_id for update;
  if m.se_fue is not null and tipo_accion not in ('mensaje','frase','sentir','necesito_amor','pedir_ubicacion','foto','pregunta','alerta','llegue') then
    raise exception 'Tu panda se fue 🎒 Adopten uno nuevo';
  end if;
  en := public.energia_actual(m.energia_base, m.energia_desde, m.durmiendo);
  if m.durmiendo and tipo_accion in ('comida','comer','banio','juego') then
    raise exception 'Shh… está durmiendo 😴 Despertalo primero';
  end if;

  -- contadores diarios por persona
  if yo.dia_contadores is distinct from d then
    yo.caricias_hoy := 0; yo.mensajes_hoy := 0; yo.juegos_hoy := 0; yo.sentir_hoy := 0; yo.dia_contadores := d;
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

  -- ---------- v2: cuidados estilo Pou ----------
  elsif tipo_accion = 'banio' then
    if now() - m.ultimo_banio < interval '3 hours' then
      nota := 'limpio';
    else
      suma := 4; m.ultimo_banio := now(); m.banios_total := m.banios_total + 1;
    end if;
  elsif tipo_accion = 'dormir' then
    if m.durmiendo then nota := 'ya_duerme';
    else
      if en < 70 then suma := 2; else nota := 'sin_sueno'; end if;
      m.energia_base := en; m.energia_desde := now(); m.durmiendo := true;
    end if;
  elsif tipo_accion = 'despertar' then
    if not m.durmiendo then nota := 'ya_despierto';
    else
      if en < 50 then nota := 'sueno'; end if;
      m.energia_base := en; m.energia_desde := now(); m.durmiendo := false;
    end if;
  elsif tipo_accion = 'comer' then
    info := public.item_info(texto_ev);
    if info is null or info->>'tipo' <> 'comida' then raise exception 'Esa comida no existe'; end if;
    cant := coalesce((m.inventario->>texto_ev)::int, 0);
    if cant < 1 then raise exception 'No queda en la heladera. Comprá en la tienda 🛍️'; end if;
    if now() - m.ultima_comida < interval '2 hours' then
      nota := 'lleno'; -- no la come: sigue en la heladera
    else
      m.inventario := jsonb_set(m.inventario, array[texto_ev], to_jsonb(cant - 1));
      m.ultima_comida := least(now(), greatest(m.ultima_comida, now() - interval '24 hours')
                               + make_interval(hours => (info->>'horas')::int));
      suma := (info->>'amor')::int;
      if (info->>'energia')::int > 0 then
        m.energia_base := least(100, en + (info->>'energia')::int); m.energia_desde := now();
      end if;
      if coalesce((info->>'carino')::boolean, false) then m.ultima_caricia := now(); end if;
      m.comidas_total := m.comidas_total + 1;
    end if;
  elsif tipo_accion = 'juego' then
    if texto_ev !~ '^\d{1,4}$' then raise exception 'Puntaje inválido'; end if;
    puntaje := least(300, texto_ev::int);
    if en < 10 then raise exception 'Está muy cansado para jugar 😴 Acostalo a dormir'; end if;
    yo.juegos_hoy := yo.juegos_hoy + 1;
    if yo.juegos_hoy <= 5 then suma := 3; ganadas := least(20, puntaje / 3); else nota := 'tope_juegos'; end if;
    m.energia_base := en - 10; m.energia_desde := now(); m.juegos_total := m.juegos_total + 1;
    texto_ev := puntaje::text;
  elsif tipo_accion = 'sentir' then
    yo.sentir_hoy := yo.sentir_hoy + 1;
    if yo.sentir_hoy <= 5 then suma := 3; end if;
    m.mensajes_sin_analizar := m.mensajes_sin_analizar + 1;
  elsif tipo_accion = 'pregunta' then
    if exists (select 1 from public.eventos where de = yo.user_id and tipo = 'pregunta' and creado >= public.inicio_hoy()) then
      raise exception 'Ya respondiste la pregunta de hoy';
    end if;
    suma := 5;
  elsif tipo_accion = 'foto' then
    if (select count(*) from public.fotos where de = yo.user_id and creado >= public.inicio_hoy()) <= 3 then suma := 5; end if;
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
      ganadas := ganadas + 5;
      nota := coalesce(nota, 'racha');
    end if;
    -- lo cuidaron: se olvida de irse
    if m.se_fue is null then m.ultimo_cuidado := now(); m.aviso_abandono := 0; end if;
  end if;

  m.amor := m.amor + suma + extra;
  m.monedas := m.monedas + ganadas;
  if m.mensajes_sin_analizar >= 8 then analizar := true; end if;
  m.actualizada := now();

  update public.miembros set ultimo_dia = yo.ultimo_dia, caricias_hoy = yo.caricias_hoy,
         mensajes_hoy = yo.mensajes_hoy, juegos_hoy = yo.juegos_hoy, sentir_hoy = yo.sentir_hoy,
         dia_contadores = yo.dia_contadores
   where user_id = yo.user_id;
  update public.mascotas set amor = m.amor, racha = m.racha, mejor_racha = m.mejor_racha,
         racha_dia = m.racha_dia, ultima_comida = m.ultima_comida, ultima_caricia = m.ultima_caricia,
         comidas_total = m.comidas_total, caricias_total = m.caricias_total, frases_total = m.frases_total,
         mensajes_sin_analizar = m.mensajes_sin_analizar, actualizada = m.actualizada,
         monedas = m.monedas, ultimo_banio = m.ultimo_banio, durmiendo = m.durmiendo,
         energia_base = m.energia_base, energia_desde = m.energia_desde, inventario = m.inventario,
         ultimo_cuidado = m.ultimo_cuidado, aviso_abandono = m.aviso_abandono,
         banios_total = m.banios_total, juegos_total = m.juegos_total
   where pareja_id = m.pareja_id;

  insert into public.eventos (pareja_id, de, tipo, texto, ref)
    values (yo.pareja_id, yo.user_id, tipo_accion, texto_ev, case when tipo_accion = 'foto' then ref_foto end)
    returning id into ev;

  select row_to_json(x) into fila from public.mascotas x where pareja_id = m.pareja_id;
  return json_build_object('evento', ev, 'sumo', suma, 'extra', extra, 'nota', nota,
                           'analizar', analizar, 'amor', m.amor, 'racha', m.racha,
                           'monedas_ganadas', ganadas, 'mascota', fila);
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

-- Calendario: fecha en que empezaron y fechas especiales (cumpleaños, etc.)
create or replace function public.guardar_fechas(inicio date, especiales jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja(); limpio jsonb;
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  if inicio is not null and inicio > public.hoy() then raise exception 'La fecha no puede ser en el futuro'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'titulo', left(coalesce(e->>'titulo', 'Fecha especial'), 40),
           'fecha', (e->>'fecha')::date,
           'emoji', left(coalesce(e->>'emoji', '🎉'), 4))), '[]'::jsonb)
    into limpio
    from jsonb_array_elements(coalesce(especiales, '[]'::jsonb)) e
   where e->>'fecha' ~ '^\d{4}-\d{2}-\d{2}$';
  if jsonb_array_length(limpio) > 20 then raise exception 'Máximo 20 fechas'; end if;
  update public.parejas set fecha_inicio = inicio, fechas = limpio where id = p;
  return public.mi_estado();
end $$;
grant execute on function public.guardar_fechas(date, jsonb) to authenticated;

-- ---------------------------------------------------------------------
--  UBICACIÓN EN VIVO (tipo Snapchat). La activa cada uno para SÍ MISMO.
--  El celular recibe una clave propia y manda su ubicación cada tanto,
--  aunque la app esté cerrada. Se guarda SOLO la última ubicación (sin historial).
-- ---------------------------------------------------------------------
alter table public.ubicaciones add column if not exists en_vivo boolean not null default false;
create table if not exists public.vivo_claves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  clave_hash text not null unique,
  creada     timestamptz not null default now()
);
alter table public.vivo_claves enable row level security; -- nadie la lee desde la app

create or replace function public.iniciar_vivo() returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja(); clave text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  insert into public.vivo_claves (user_id, clave_hash) values (auth.uid(), public.hash_clave(clave))
  on conflict (user_id) do update set clave_hash = excluded.clave_hash, creada = now();
  update public.ubicaciones set en_vivo = true where user_id = auth.uid();
  insert into public.eventos (pareja_id, de, tipo, texto) values (p, auth.uid(), 'ubicacion', 'en_vivo');
  return json_build_object('clave', clave);
end $$;

-- La llama el servicio de Android (sin sesión: se identifica con la clave)
create or replace function public.vivo_ubicacion(clave text, la double precision, ln double precision, prec int default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare u uuid; p uuid;
begin
  select user_id into u from public.vivo_claves where clave_hash = public.hash_clave(clave);
  if u is null then return false; end if; -- dejó de compartir: el celular frena solo
  select pareja_id into p from public.miembros where user_id = u;
  if p is null then return false; end if;
  if la not between -90 and 90 or ln not between -180 and 180 then raise exception 'Ubicación inválida'; end if;
  insert into public.ubicaciones (user_id, pareja_id, lat, lng, precision_m, actualizada, en_vivo)
    values (u, p, la, ln, prec, now(), true)
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, precision_m = excluded.precision_m,
    actualizada = now(), pareja_id = excluded.pareja_id, en_vivo = true;
  return true;
end $$;

create or replace function public.detener_vivo(clave text default null) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null and clave is not null then select user_id into u from public.vivo_claves where clave_hash = public.hash_clave(clave); end if;
  if u is null then return; end if;
  delete from public.vivo_claves where user_id = u;
  update public.ubicaciones set en_vivo = false where user_id = u;
end $$;
grant execute on function public.iniciar_vivo() to authenticated;
grant execute on function public.vivo_ubicacion(text, double precision, double precision, int) to anon, authenticated;
grant execute on function public.detener_vivo(text) to anon, authenticated;

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
  delete from public.vivo_claves where user_id = auth.uid();
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

-- Frase y pregunta del día (las genera Gemini una vez por día y las ven los dos).
-- La primera que llega gana: si ya hay de hoy, devuelve esas. Se guardan las últimas 40 para no repetir.
create or replace function public.guardar_dia(frase text, pregunta text) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja(); m public.mascotas;
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  select * into m from public.mascotas where pareja_id = p for update;
  if m.frase_fecha is distinct from public.hoy() then
    update public.mascotas set
      frase_dia = left(frase, 300), pregunta_dia = nullif(left(pregunta, 200), ''), frase_fecha = public.hoy(),
      frases_previas = (array_prepend(left(frase, 300), frases_previas))[1:40],
      preguntas_previas = case when coalesce(pregunta, '') = '' then preguntas_previas
                               else (array_prepend(left(pregunta, 200), preguntas_previas))[1:40] end
    where pareja_id = p returning * into m;
  end if;
  return json_build_object('frase', m.frase_dia, 'pregunta', m.pregunta_dia);
end $$;
grant execute on function public.guardar_dia(text, text) to authenticated;

create or replace function public.guardar_frase_dia(frase text) returns void
language sql security definer set search_path = public as $$
  update public.mascotas set frase_dia = left(frase, 300), frase_fecha = public.hoy()
   where pareja_id = public.mi_pareja();
$$;

-- ---------------------------------------------------------------------
--  TIENDA: comprar comida (va a la heladera) y accesorios
-- ---------------------------------------------------------------------
create or replace function public.comprar(item text) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja(); m public.mascotas; info jsonb := public.item_info(item); precio int;
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  if info is null then raise exception 'Eso no está en la tienda'; end if;
  select * into m from public.mascotas where pareja_id = p for update;
  if m.se_fue is not null then raise exception 'Tu panda se fue 🎒 Adopten uno nuevo'; end if;
  precio := (info->>'precio')::int;
  if info->>'tipo' = 'accesorio' and m.accesorios ? item then raise exception 'Ya lo tienen'; end if;
  if m.monedas < precio then raise exception 'Les faltan % monedas 🪙', precio - m.monedas; end if;
  if info->>'tipo' = 'comida' then
    update public.mascotas set monedas = monedas - precio,
      inventario = jsonb_set(inventario, array[item], to_jsonb(coalesce((inventario->>item)::int, 0) + 1)),
      actualizada = now()
     where pareja_id = p;
  else
    update public.mascotas set monedas = monedas - precio, accesorios = accesorios || to_jsonb(item), actualizada = now()
     where pareja_id = p;
  end if;
  insert into public.eventos (pareja_id, de, tipo, texto) values (p, auth.uid(), 'compra', item);
  return (select row_to_json(x) from public.mascotas x where pareja_id = p);
end $$;

-- Ponerle o sacarle un accesorio (uno por lugar: cabeza, cara, cuello)
create or replace function public.poner_accesorio(item text, poner boolean) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja(); m public.mascotas; lugar text := public.item_info(item)->>'lugar'; nuevos jsonb;
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  select * into m from public.mascotas where pareja_id = p for update;
  if poner and not (m.accesorios ? item) then raise exception 'Primero hay que comprarlo'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into nuevos
    from jsonb_array_elements_text(m.puestos) x
   where x <> item and (not poner or public.item_info(x)->>'lugar' is distinct from lugar);
  if poner then nuevos := nuevos || to_jsonb(item); end if;
  update public.mascotas set puestos = nuevos, actualizada = now() where pareja_id = p;
  return (select row_to_json(x) from public.mascotas x where pareja_id = p);
end $$;

-- ---------------------------------------------------------------------
--  DESAFÍOS DEL DÍA (dan monedas). Mantener igual que DESAFIOS en web/js/reglas.js
--  Cada persona tiene 3 por día: 1 "de pareja" + 2 "de cuidado".
-- ---------------------------------------------------------------------
create or replace function public.desafios_hoy(lugar int) returns table (clave text, meta int, premio int, tipos text[])
language sql stable as $$
  (select * from (values
     ('foto', 1, 30, array['foto']), ('frase', 1, 15, array['frase']), ('mensajes', 3, 15, array['mensaje']),
     ('sentir', 1, 15, array['sentir']), ('pregunta', 1, 15, array['pregunta'])) v(clave, meta, premio, tipos)
   order by md5(public.hoy()::text || lugar::text || v.clave) limit 1)
  union all
  (select * from (values
     ('mimos', 5, 10, array['caricia']), ('banio', 1, 10, array['banio']), ('comer', 2, 10, array['comida','comer']),
     ('jugar', 1, 15, array['juego']), ('dormir', 1, 10, array['dormir'])) v(clave, meta, premio, tipos)
   order by md5(public.hoy()::text || lugar::text || v.clave) limit 2)
$$;

create or replace function public.mis_desafios() returns json
language plpgsql stable security definer set search_path = public as $$
declare yo public.miembros;
begin
  select * into yo from public.miembros where user_id = auth.uid();
  if not found then raise exception 'No estás en una pareja'; end if;
  return json_build_object(
    'regalo_cobrado', exists (select 1 from public.eventos where de = yo.user_id and tipo = 'desafio'
                                 and texto = 'diario' and creado >= public.inicio_hoy()),
    'desafios', (select json_agg(json_build_object(
        'clave', d.clave, 'meta', d.meta, 'premio', d.premio,
        'progreso', (select count(*) from public.eventos e where e.de = yo.user_id and e.tipo = any (d.tipos)
                       and e.creado >= public.inicio_hoy()),
        'cobrado', exists (select 1 from public.eventos e where e.de = yo.user_id and e.tipo = 'desafio'
                             and e.texto = d.clave and e.creado >= public.inicio_hoy())))
      from public.desafios_hoy(yo.lugar) d));
end $$;

create or replace function public.reclamar_desafio(clave_desafio text) returns json
language plpgsql security definer set search_path = public as $$
declare yo public.miembros; d record; premio int; hecho int;
begin
  select * into yo from public.miembros where user_id = auth.uid();
  if not found then raise exception 'No estás en una pareja'; end if;
  if exists (select 1 from public.eventos where de = yo.user_id and tipo = 'desafio'
               and texto = clave_desafio and creado >= public.inicio_hoy()) then
    raise exception 'Ya lo cobraste hoy';
  end if;
  if clave_desafio = 'diario' then
    premio := 10;
  else
    select * into d from public.desafios_hoy(yo.lugar) x where x.clave = clave_desafio;
    if not found then raise exception 'Ese desafío no es de hoy'; end if;
    select count(*) into hecho from public.eventos e where e.de = yo.user_id and e.tipo = any (d.tipos)
       and e.creado >= public.inicio_hoy();
    if hecho < d.meta then raise exception 'Todavía no está cumplido'; end if;
    premio := d.premio;
  end if;
  update public.mascotas set monedas = monedas + premio, actualizada = now() where pareja_id = yo.pareja_id;
  insert into public.eventos (pareja_id, de, tipo, texto) values (yo.pareja_id, yo.user_id, 'desafio', clave_desafio);
  return json_build_object('premio', premio,
    'mascota', (select row_to_json(x) from public.mascotas x where pareja_id = yo.pareja_id));
end $$;

-- ---------------------------------------------------------------------
--  FOTOS (comprimidas en el celular antes de mandarlas)
-- ---------------------------------------------------------------------
create or replace function public.enviar_foto(datos text, texto text default null) returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja(); id_foto bigint; r json;
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  if datos !~ '^data:image/(jpeg|png|webp);base64,' then raise exception 'Eso no es una foto'; end if;
  if char_length(datos) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if (select count(*) from public.fotos where de = auth.uid() and creado >= public.inicio_hoy()) >= 10 then
    raise exception 'Ya mandaste 10 fotos hoy 📸 Mañana más';
  end if;
  insert into public.fotos (pareja_id, de, datos) values (p, auth.uid(), datos) returning id into id_foto;
  perform set_config('panda.ref', id_foto::text, true);
  r := public.registrar_accion('foto', coalesce(nullif(trim(texto), ''), '📸'));
  perform set_config('panda.ref', '', true);
  return r;
end $$;

-- ---------------------------------------------------------------------
--  ABANDONO: si nadie lo cuida, avisa (3 y 5 días) y a los 7 días se va
-- ---------------------------------------------------------------------
create or replace function public.revisar_abandono(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.mascotas; dias numeric; nadie constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  select * into m from public.mascotas where pareja_id = p for update;
  if not found or m.se_fue is not null then return; end if;
  dias := extract(epoch from now() - m.ultimo_cuidado) / 86400;
  if dias >= 7 then
    update public.mascotas set se_fue = now(), durmiendo = false, actualizada = now() where pareja_id = p;
    insert into public.eventos (pareja_id, de, tipo, texto) values (p, nadie, 'sistema',
      'se_fue|' || m.nombre || '|' || m.amor || '|' || greatest(1, ceil(extract(epoch from now() - m.nacio) / 86400))::int);
  elsif dias >= 5 and m.aviso_abandono < 2 then
    update public.mascotas set aviso_abandono = 2, actualizada = now() where pareja_id = p;
    insert into public.eventos (pareja_id, de, tipo, texto) values (p, nadie, 'sistema', 'aviso_abandono|2');
  elsif dias >= 3 and m.aviso_abandono < 1 then
    update public.mascotas set aviso_abandono = 1, actualizada = now() where pareja_id = p;
    insert into public.eventos (pareja_id, de, tipo, texto) values (p, nadie, 'sistema', 'aviso_abandono|1');
  end if;
end $$;

-- La app lo llama al abrir: revisa el abandono y devuelve el estado
create or replace function public.revisar_panda() returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja();
begin
  if p is not null then perform public.revisar_abandono(p); end if;
  return public.mi_estado();
end $$;

-- Después de que se fue: adoptar un panda nuevo (empieza de cero; los mensajes quedan)
create or replace function public.adoptar_panda(nombre_panda text default 'Pandi') returns json
language plpgsql security definer set search_path = public as $$
declare p uuid := public.mi_pareja();
begin
  if p is null then raise exception 'No estás en una pareja'; end if;
  if (select se_fue from public.mascotas where pareja_id = p) is null then raise exception 'Su panda sigue con ustedes 🐼'; end if;
  update public.mascotas set
    nombre = coalesce(nullif(trim(nombre_panda), ''), 'Pandi'), amor = 0, racha = 0, mejor_racha = 0, racha_dia = null,
    ultima_comida = now() - interval '6 hours', ultima_caricia = now(), comidas_total = 0, caricias_total = 0,
    frases_total = 0, animo = 'feliz', animo_nota = null, mensajes_sin_analizar = 0, frase_dia = null, frase_fecha = null,
    nacio = now(), actualizada = now(), monedas = 50, ultimo_banio = now(), durmiendo = false, energia_base = 100,
    energia_desde = now(), inventario = '{"manzana": 2}'::jsonb, accesorios = '[]'::jsonb, puestos = '[]'::jsonb,
    ultimo_cuidado = now(), aviso_abandono = 0, se_fue = null, generacion = generacion + 1, banios_total = 0, juegos_total = 0
  where pareja_id = p;
  insert into public.eventos (pareja_id, de, tipo, texto) values (p, auth.uid(), 'sistema', 'nacio');
  return public.mi_estado();
end $$;

-- ---------------------------------------------------------------------
--  MANTENIMIENTO: limpieza para que la base gratis (500 MB) dure años
-- ---------------------------------------------------------------------
--  · Borra eventos de más de 180 días (salvo favoritos y frases)
--  · Borra frases de más de 2 años (salvo favoritas)
--  · Borra el contador de Gemini de más de 30 días
--  · Borra fotos de más de 120 días (salvo las guardadas con 💖)
--  · Revisa si algún panda está abandonado (avisa o se va)
--  · Si la base pasa los 400 MB, borra los eventos y fotos más viejos (no favoritos)
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
  delete from public.fotos f where f.creado < now() - interval '120 days'
     and not exists (select 1 from public.eventos e where e.ref = f.id and e.favorito);
  get diagnostics n = row_count; borrados := borrados + n;
  perform public.revisar_abandono(pareja_id) from public.mascotas where se_fue is null;

  tam := pg_database_size(current_database());
  if tam > 400 * 1024 * 1024 then
    delete from public.eventos where id in (
      select id from public.eventos where favorito = false
       order by creado asc limit greatest(1000, (select count(*) / 5 from public.eventos)));
    get diagnostics n = row_count; borrados := borrados + n;
    delete from public.fotos where id in (
      select f.id from public.fotos f where not exists (select 1 from public.eventos e where e.ref = f.id and e.favorito)
       order by f.creado asc limit greatest(50, (select count(*) / 4 from public.fotos)));
    get diagnostics n = row_count; borrados := borrados + n;
  end if;
  return json_build_object('borrados', borrados, 'tam_mb', round(tam / 1048576.0, 1),
                           'eventos', (select count(*) from public.eventos), 'fotos', (select count(*) from public.fotos));
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
alter table public.fotos       enable row level security;

drop policy if exists "ver mi pareja"       on public.parejas;
drop policy if exists "ver miembros"        on public.miembros;
drop policy if exists "ver mi panda"        on public.mascotas;
drop policy if exists "ver eventos"         on public.eventos;
drop policy if exists "ver ubicaciones"     on public.ubicaciones;
drop policy if exists "ver mi uso"          on public.uso_gemini;
drop policy if exists "ver fotos"           on public.fotos;

create policy "ver mi pareja"   on public.parejas     for select to authenticated using (id = public.mi_pareja());
create policy "ver miembros"    on public.miembros    for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver mi panda"    on public.mascotas    for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver eventos"     on public.eventos     for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver ubicaciones" on public.ubicaciones for select to authenticated using (pareja_id = public.mi_pareja());
create policy "ver mi uso"      on public.uso_gemini  for select to authenticated using (user_id = auth.uid());
create policy "ver fotos"       on public.fotos       for select to authenticated using (pareja_id = public.mi_pareja());
-- No hay políticas de insert/update/delete: todo se modifica con las funciones de arriba.

-- La clave de recuperación no se expone: solo se pueden leer estas columnas
revoke all on public.miembros from anon, authenticated;
grant select (user_id, pareja_id, lugar, nombre, compartir_auto, ultimo_dia, unido) on public.miembros to authenticated;

-- Quién puede llamar a cada función
revoke execute on all functions in schema public from public, anon;
grant execute on function public.ping()                                   to anon, authenticated;
-- ubicación en vivo: el servicio de Android se identifica con su clave (sin sesión)
grant execute on function public.vivo_ubicacion(text, double precision, double precision, int) to anon, authenticated;
grant execute on function public.detener_vivo(text)                      to anon, authenticated;
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
grant execute on function public.item_info(text)                          to authenticated;
grant execute on function public.energia_actual(int, timestamptz, boolean) to authenticated;
grant execute on function public.inicio_hoy()                             to authenticated;
grant execute on function public.comprar(text)                            to authenticated;
grant execute on function public.poner_accesorio(text, boolean)           to authenticated;
grant execute on function public.desafios_hoy(int)                        to authenticated;
grant execute on function public.mis_desafios()                           to authenticated;
grant execute on function public.reclamar_desafio(text)                   to authenticated;
grant execute on function public.enviar_foto(text, text)                   to authenticated;
grant execute on function public.revisar_panda()                          to authenticated;
grant execute on function public.adoptar_panda(text)                      to authenticated;
-- revisar_abandono(uuid) NO se da a nadie: la usan revisar_panda y mantenimiento por dentro

-- ---------------------------------------------------------------------
--  TIEMPO REAL: avisos instantáneos entre los dos celulares
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.eventos;  exception when others then null; end;
  begin alter publication supabase_realtime add table public.mascotas; exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
--  NOTIFICACIONES PUSH (Firebase): llegan aunque la app esté cerrada
--  1) La app guarda el "token" de cada celular (guardar_token_push).
--  2) Cuando se guarda un evento importante, este trigger le pide a Vercel
--     (/api/push) que mande la notificación al celular de la otra persona.
--  Los tokens no se pueden leer desde la app (RLS sin políticas).
-- ---------------------------------------------------------------------
create table if not exists public.push_tokens (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  token       text not null,
  actualizado timestamptz not null default now()
);
alter table public.push_tokens enable row level security;

create or replace function public.guardar_token_push(token_push text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  if token_push is null or char_length(token_push) not between 20 and 4096 then raise exception 'Token inválido'; end if;
  -- si el mismo celular estaba con otra sesión, se lo saca de ahí
  delete from public.push_tokens where token = token_push and user_id <> auth.uid();
  insert into public.push_tokens (user_id, token, actualizado) values (auth.uid(), token_push, now())
  on conflict (user_id) do update set token = excluded.token, actualizado = now();
end $$;
grant execute on function public.guardar_token_push(text) to authenticated;

-- pg_net permite llamar a una URL desde la base (viene en Supabase)
do $$ begin
  create extension if not exists pg_net;
exception when others then raise notice 'pg_net no disponible: no habrá notificaciones push (el panda flotante sigue avisando).';
end $$;

-- Dirección de la función de Vercel que manda las push (cambiala si tu app tiene otra dirección)
create or replace function public.url_push() returns text language sql immutable as $$
  select 'https://panda-amor.vercel.app/api/push'
$$;

create or replace function public.avisar_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quien text; panda text; titulo text; cuerpo text; tipo_aviso text := new.tipo; tokens jsonb;
  txt text := coalesce(new.texto, '');
begin
  if new.tipo not in ('necesito_amor','pedir_ubicacion','mensaje','frase','ubicacion','sentir','foto','pregunta','sistema','alerta','llegue') then return new; end if;
  if new.tipo = 'sistema' and txt not like 'aviso_abandono|%' and txt not like 'se_fue|%' then return new; end if;

  -- a quién: la otra persona (en los avisos del sistema, a los dos)
  select jsonb_agg(t.token) into tokens
    from public.push_tokens t join public.miembros mi on mi.user_id = t.user_id
   where mi.pareja_id = new.pareja_id and t.user_id <> new.de;
  if tokens is null then return new; end if;

  select nombre into quien from public.miembros where user_id = new.de;
  quien := coalesce(quien, 'Tu pareja');
  select nombre into panda from public.mascotas where pareja_id = new.pareja_id;
  panda := coalesce(panda, 'Tu panda');

  if new.tipo = 'necesito_amor' then titulo := '💗 ' || quien || ' necesita amor'; cuerpo := 'Tocá para mandarle mimos';
  elsif new.tipo = 'pedir_ubicacion' then titulo := '📍 ' || quien || ' quiere saber dónde estás'; cuerpo := 'Tocá para compartir tu ubicación';
  elsif new.tipo = 'mensaje' then titulo := '💬 ' || quien; cuerpo := txt;
  elsif new.tipo = 'frase' then titulo := '💌 Frase de ' || quien; cuerpo := txt;
  elsif new.tipo = 'ubicacion' and txt = 'en_vivo' then titulo := '📡 ' || quien || ' comparte su ubicación en vivo'; cuerpo := 'Tocá para ver dónde está ahora';
  elsif new.tipo = 'ubicacion' then titulo := '📍 ' || quien || ' compartió dónde está'; cuerpo := 'Tocá para verlo en el mapa';
  elsif new.tipo = 'llegue' then
    titulo := case when txt like 'a casa%' then '🏠 ' else '📍 ' end || quien || ' llegó' || case when txt <> '' then ' ' || txt else ' bien' end;
    cuerpo := '¡Llegué, amor! 💗';
  elsif new.tipo = 'alerta' then
    titulo := '🚨 ¡ALERTA! 🚨';
    cuerpo := quien || ' quiere saber: ¿estás con ' || case when txt = 'hombre' then 'otro hombre' else 'otra mujer' end || '? 🤨';
  elsif new.tipo = 'sentir' then titulo := '💭 ' || quien || ': ' || split_part(txt, ' · ', 1); cuerpo := coalesce(nullif(substr(txt, char_length(split_part(txt, ' · ', 1)) + 4), ''), 'Tocá para responderle');
  elsif new.tipo = 'foto' then titulo := '📸 ' || quien || ' te mandó una foto'; cuerpo := case when txt in ('', '📸') then 'Tocá para verla' else txt end;
  elsif new.tipo = 'pregunta' then titulo := '❓ ' || quien || ' respondió la pregunta del día'; cuerpo := 'Respondé para ver qué puso';
  elsif txt like 'aviso_abandono|2%' then titulo := '🎒 ' || panda || ' está por irse'; cuerpo := 'Última oportunidad: cuídenlo hoy o se va.'; tipo_aviso := 'aviso';
  elsif txt like 'aviso_abandono|%' then titulo := '🥺 ' || panda || ' se siente solo'; cuerpo := 'Hace días que nadie lo cuida.'; tipo_aviso := 'aviso';
  else titulo := '🎒 ' || split_part(txt, '|', 2) || ' se fue'; cuerpo := 'Nadie lo cuidó por 7 días. Abran la app para adoptar uno nuevo.'; tipo_aviso := 'aviso';
  end if;

  perform net.http_post(
    url := public.url_push(),
    body := jsonb_build_object('tokens', tokens, 'titulo', left(titulo, 120), 'texto', left(cuerpo, 300), 'tipo', tipo_aviso),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  return new; -- un aviso que falla nunca impide guardar el evento
end $$;

-- Botón "Probar notificación" (Ajustes): se manda una push a uno mismo, con 10 s de espera
-- para que alcances a cerrar la app. Devuelve false si este celular todavía no registró su token.
create or replace function public.probar_push() returns boolean
language plpgsql security definer set search_path = public as $$
declare tk text;
begin
  select token into tk from public.push_tokens where user_id = auth.uid();
  if tk is null then return false; end if;
  perform net.http_post(
    url := public.url_push(),
    body := jsonb_build_object('tokens', jsonb_build_array(tk), 'titulo', '🐼 ¡Funciona!',
      'texto', 'Así te van a llegar los avisos aunque la app esté cerrada.', 'tipo', 'mensaje', 'demora', 10),
    headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 20000);
  return true;
end $$;
grant execute on function public.probar_push() to authenticated;

-- ---------------------------------------------------------------------
--  CALENDARIO: avisa (push a los dos) cuando cumplen meses o años y en las
--  fechas especiales, y el día anterior para que no se olviden.
-- ---------------------------------------------------------------------
create or replace function public.cumple_en(inicio date, dia date) returns int  -- meses que cumplen ese día (0 si no cumplen)
language sql immutable as $$
  select case
    when inicio is null or dia <= inicio then 0
    -- mismo día del mes (o el último día si el mes es más corto: ej. empezaron un 31)
    when extract(day from dia) = extract(day from inicio)
      or (extract(day from inicio) > extract(day from dia) and dia = (date_trunc('month', dia) + interval '1 month - 1 day')::date)
    then ((extract(year from dia) - extract(year from inicio)) * 12 + extract(month from dia) - extract(month from inicio))::int
    else 0 end
$$;

create or replace function public.avisos_fechas() returns void
language plpgsql security definer set search_path = public as $$
declare
  pa record; f jsonb; tokens jsonb; d date := public.hoy(); man date := public.hoy() + 1;
  meses int; titulo text; cuerpo text; fd date;
begin
  for pa in select pr.id, pr.fecha_inicio, pr.fechas, ma.avisos_push, ma.nombre from public.parejas pr join public.mascotas ma on ma.pareja_id = pr.id loop
    if pa.avisos_push ? ('fechas_' || d) then continue; end if;
    select jsonb_agg(t.token) into tokens from public.push_tokens t join public.miembros mi on mi.user_id = t.user_id where mi.pareja_id = pa.id;
    if tokens is null then continue; end if;
    titulo := null;
    meses := public.cumple_en(pa.fecha_inicio, d);
    if meses > 0 then
      if meses % 12 = 0 then titulo := '🎉 ¡Hoy cumplen ' || (meses / 12) || case when meses = 12 then ' año' else ' años' end || ' juntos!';
      else titulo := '💕 ¡Hoy cumplen ' || meses || case when meses = 1 then ' mes' else ' meses' end || '!'; end if;
      cuerpo := pa.nombre || ' les prepara un abrazo gigante. ¡Feliz aniversario! 🐼';
    elsif public.cumple_en(pa.fecha_inicio, man) > 0 then
      meses := public.cumple_en(pa.fecha_inicio, man);
      titulo := '⏰ Mañana cumplen ' || case when meses % 12 = 0 then (meses / 12) || case when meses = 12 then ' año' else ' años' end else meses || case when meses = 1 then ' mes' else ' meses' end end;
      cuerpo := '¡Que no se les olvide! 💕';
    end if;
    if titulo is null then
      for f in select * from jsonb_array_elements(pa.fechas) loop
        fd := (f->>'fecha')::date;
        if extract(month from fd) = extract(month from d) and extract(day from fd) = extract(day from d) then
          titulo := coalesce(f->>'emoji', '🎉') || ' ¡Hoy es ' || (f->>'titulo') || '!'; cuerpo := 'Un día especial para ustedes 💕'; exit;
        elsif extract(month from fd) = extract(month from man) and extract(day from fd) = extract(day from man) then
          titulo := '⏰ Mañana: ' || (f->>'titulo') || ' ' || coalesce(f->>'emoji', ''); cuerpo := '¡Que no se les olvide! 💕'; exit;
        end if;
      end loop;
    end if;
    if titulo is null then continue; end if;
    -- se marca hoy (y se borran las marcas de días viejos para que no crezca)
    update public.mascotas set avisos_push =
      (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(avisos_push) as x(k, v) where k not like 'fechas_%')
      || jsonb_build_object('fechas_' || d, now())
     where pareja_id = pa.id;
    begin
      perform net.http_post(url := public.url_push(),
        body := jsonb_build_object('tokens', tokens, 'titulo', titulo, 'texto', cuerpo, 'tipo', 'fecha'),
        headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 8000);
    exception when others then null;
    end;
  end loop;
end $$;
revoke execute on function public.avisos_fechas() from public, anon, authenticated;
grant execute on function public.cumple_en(date, date) to authenticated;

-- ---------------------------------------------------------------------
--  EL PANDA AVISA CUANDO NECESITA ALGO (push a los dos, cada hora)
--  Hambre, sueño/energía, mimos, baño. Cada necesidad se avisa como mucho
--  cada 8 horas y nunca de noche (23 a 9 h, hora de Argentina).
--  También revisa el abandono de todos los pandas (avisos de "se siente solo"
--  y "se va"), así llegan aunque nadie abra la app.
-- ---------------------------------------------------------------------
alter table public.mascotas add column if not exists avisos_push jsonb not null default '{}';

create or replace function public.avisos_necesidades() returns int
language plpgsql security definer set search_path = public as $$
declare
  m record; tokens jsonb; necesidad text; titulo text; cuerpo text; ult timestamptz; cuenta int := 0;
  hora int := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
begin
  for m in select pareja_id from public.mascotas where se_fue is null loop
    begin perform public.revisar_abandono(m.pareja_id); exception when others then null; end;
  end loop;
  if hora >= 23 or hora < 9 then return 0; end if;
  if hora = 10 then perform public.avisos_fechas(); end if; -- aniversarios y fechas especiales (una vez por día)

  for m in select * from public.mascotas where se_fue is null loop
    necesidad := null;
    if now() - m.ultima_comida > interval '9 hours' then
      necesidad := 'hambre'; titulo := '🎋 ' || m.nombre || ' tiene hambre'; cuerpo := '¿Alguno me da bambú? Tengo la panza vacía 🥺';
    elsif not m.durmiendo and public.energia_actual(m.energia_base, m.energia_desde, false) < 20 then
      necesidad := 'energia'; titulo := '😴 ' || m.nombre || ' está muy cansado'; cuerpo := 'Me quedé sin energía… ¿me acuestan a dormir un ratito?';
    elsif now() - m.ultima_caricia > interval '13 hours' then
      necesidad := 'carino'; titulo := '💗 ' || m.nombre || ' extraña sus mimos'; cuerpo := 'Hace un montón que nadie me hace mimitos 🥹';
    elsif now() - m.ultimo_banio > interval '18 hours' then
      necesidad := 'limpieza'; titulo := '🛁 ' || m.nombre || ' está sucio'; cuerpo := '¡Necesito un baño con mucha espuma!';
    end if;
    if necesidad is null then continue; end if;
    ult := (m.avisos_push ->> necesidad)::timestamptz;
    if ult is not null and now() - ult < interval '6 hours' then continue; end if;

    select jsonb_agg(t.token) into tokens
      from public.push_tokens t join public.miembros mi on mi.user_id = t.user_id
     where mi.pareja_id = m.pareja_id;
    if tokens is null then continue; end if;

    update public.mascotas set avisos_push = avisos_push || jsonb_build_object(necesidad, now()) where pareja_id = m.pareja_id;
    begin
      perform net.http_post(url := public.url_push(),
        body := jsonb_build_object('tokens', tokens, 'titulo', titulo, 'texto', cuerpo, 'tipo', 'necesidad'),
        headers := '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds := 8000);
      cuenta := cuenta + 1;
    exception when others then null;
    end;
  end loop;
  return cuenta;
end $$;
-- solo la corre el reloj de la base (pg_cron), no la app
revoke execute on function public.avisos_necesidades() from public, anon, authenticated;

drop trigger if exists eventos_push on public.eventos;
create trigger eventos_push after insert on public.eventos
  for each row execute function public.avisar_push();

-- ---------------------------------------------------------------------
--  LIMPIEZA AUTOMÁTICA DIARIA (4 AM Argentina = 7 UTC)
--  Si pg_cron no está disponible no pasa nada: Vercel también la ejecuta.
-- ---------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('panda-limpieza') where exists (select 1 from cron.job where jobname = 'panda-limpieza');
  perform cron.schedule('panda-limpieza', '0 7 * * *', 'select public.mantenimiento()');
  -- cada hora (minuto 17): el panda avisa si necesita algo
  perform cron.unschedule('panda-avisos') where exists (select 1 from cron.job where jobname = 'panda-avisos');
  perform cron.schedule('panda-avisos', '17 * * * *', 'select public.avisos_necesidades()');
exception when others then
  raise notice 'pg_cron no disponible: la limpieza la hace Vercel (api/mantenimiento).';
end $$;
