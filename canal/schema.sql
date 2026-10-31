-- Copia de db/schema.sql del repo CanalYoutube. Se aplica sola la primera vez que arranca Postgres, en la base "canal".

CREATE TABLE IF NOT EXISTS videos (
  id              TEXT PRIMARY KEY,          -- videoId de YouTube
  canal_id        TEXT NOT NULL,
  propio          BOOLEAN NOT NULL DEFAULT false,
  tipo            TEXT CHECK (tipo IN ('largo', 'short')),
  titulo          TEXT,
  publicado_en    TIMESTAMPTZ,
  duracion_seg    INT,
  largo_padre_id  TEXT REFERENCES videos(id), -- short -> largo al que remite
  etiquetas       JSONB DEFAULT '{}'::jsonb, -- tema, gancho, miniatura, ritmo... (las pone Claude)
  creado_en       TIMESTAMPTZ DEFAULT now()
);

-- Foto diaria de estadísticas (propias y de competencia)
CREATE TABLE IF NOT EXISTS metricas_diarias (
  video_id            TEXT REFERENCES videos(id),
  fecha               DATE NOT NULL,
  vistas              BIGINT,
  likes               BIGINT,
  comentarios         BIGINT,
  minutos_vistos      NUMERIC,
  vista_media_pct     NUMERIC,
  ctr_impresiones_pct NUMERIC,
  impresiones         BIGINT,
  subs_ganados        INT,
  PRIMARY KEY (video_id, fecha)
);

-- Curva de retención por punto del vídeo (solo propios)
CREATE TABLE IF NOT EXISTS retencion (
  video_id      TEXT REFERENCES videos(id),
  ratio         NUMERIC NOT NULL,   -- 0.00 .. 1.00 del vídeo
  retencion     NUMERIC,            -- audienceWatchRatio
  relativa      NUMERIC,            -- relativeRetentionPerformance
  PRIMARY KEY (video_id, ratio)
);

-- Perfil de audiencia por semana
CREATE TABLE IF NOT EXISTS audiencia_semanal (
  semana        DATE NOT NULL,
  dimension     TEXT NOT NULL,      -- ageGroup, gender, country, deviceType, trafficSourceType
  valor         TEXT NOT NULL,
  porcentaje    NUMERIC,
  PRIMARY KEY (semana, dimension, valor)
);

-- Temas propuestos por el analista
CREATE TABLE IF NOT EXISTS temas (
  id            SERIAL PRIMARY KEY,
  titulo        TEXT NOT NULL,
  formato       TEXT,
  porque        TEXT,               -- evidencia: outliers, comentarios, trends
  outlier_score NUMERIC,
  estado        TEXT DEFAULT 'propuesto' CHECK (estado IN ('propuesto','aprobado','descartado','producido')),
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- Guiones y su evaluación
CREATE TABLE IF NOT EXISTS guiones (
  id            SERIAL PRIMARY KEY,
  tema_id       INT REFERENCES temas(id),
  version       INT DEFAULT 1,
  texto         TEXT,
  titulos       JSONB,              -- 3 opciones
  miniaturas    JSONB,              -- 3 conceptos
  nota_critico  NUMERIC,
  feedback      TEXT,
  estado        TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador','en_revision','aprobado','rechazado')),
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- Trabajos de producción y publicación
CREATE TABLE IF NOT EXISTS producciones (
  id            SERIAL PRIMARY KEY,
  guion_id      INT REFERENCES guiones(id),
  tipo          TEXT CHECK (tipo IN ('largo','short')),
  estado        TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','renderizando','listo','subido','error')),
  archivo_url   TEXT,
  miniatura_url TEXT,
  youtube_id    TEXT,
  publicar_en   TIMESTAMPTZ,
  error         TEXT,
  creado_en     TIMESTAMPTZ DEFAULT now()
);

-- Diario de decisiones: qué se decidió y con qué datos (para aprender)
CREATE TABLE IF NOT EXISTS decisiones (
  id            SERIAL PRIMARY KEY,
  agente        TEXT,
  decision      TEXT,
  datos         JSONB,
  creado_en     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metricas_fecha ON metricas_diarias (fecha);
CREATE INDEX IF NOT EXISTS idx_videos_canal ON videos (canal_id, publicado_en);
