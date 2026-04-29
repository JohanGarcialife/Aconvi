import Link from "next/link";

export const metadata = {
  title: "Aconvi — Gestión inteligente de comunidades",
  description:
    "La plataforma integral para administradores de fincas. Incidencias, comunicados, reservas, votaciones y documentación en un solo lugar.",
};

const FEATURES = [
  {
    emoji: "🔧",
    title: "Gestión de Incidencias",
    desc: "Reporta, asigna y resuelve incidencias con proveedores especializados. Seguimiento en tiempo real para residentes y administradores.",
  },
  {
    emoji: "📢",
    title: "Comunicados y Tablón Digital",
    desc: "Publica avisos y comunicados a toda la comunidad. Notificaciones push instantáneas a todos los dispositivos.",
  },
  {
    emoji: "🏊",
    title: "Reservas de Zonas Comunes",
    desc: "Gestiona piscinas, salones y pistas deportivas con un sistema de reservas automatizado sin conflictos.",
  },
  {
    emoji: "🗳️",
    title: "Votaciones Online Legales",
    desc: "Convocatorias digitales con ponderación por coeficiente. Actas generadas automáticamente al cerrar la votación.",
  },
  {
    emoji: "📁",
    title: "Gestión Documental",
    desc: "Centraliza estatutos, actas de junta y contratos. Acceso inmediato para residentes desde el móvil.",
  },
  {
    emoji: "📅",
    title: "Agenda Inteligente",
    desc: "Tareas con recordatorios automáticos, recurrencia configurable e indicadores de vencimiento para el AF.",
  },
];

const AUDIENCE = [
  {
    emoji: "👨‍💼",
    role: "Administradores de Fincas",
    desc: "Dashboard completo para gestionar múltiples comunidades, proveedores y documentación desde un solo panel.",
    color: "#00bda5",
  },
  {
    emoji: "🏘️",
    role: "Propietarios y Vecinos",
    desc: "App móvil para reportar incidencias, votar, reservar espacios y recibir comunicados al instante.",
    color: "#6366f1",
  },
  {
    emoji: "🔨",
    role: "Proveedores y Técnicos",
    desc: "Recibe solicitudes de trabajo, envía presupuestos y registra la resolución con evidencia fotográfica.",
    color: "#f59e0b",
  },
];

export default function LandingPage() {
  return (
    <div
      style={{
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        background: "#ffffff",
        color: "#18181b",
        minHeight: "100vh",
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid #f4f4f5",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(16px)",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg, #00bda5 0%, #0891b2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 14,
              color: "#fff",
            }}
          >
            A
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, color: "#18181b" }}>Aconvi</span>
        </div>
        <Link
          href="/login"
          style={{
            background: "linear-gradient(135deg, #00bda5 0%, #0891b2 100%)",
            color: "#fff",
            padding: "8px 20px",
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Acceso al Portal →
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "100px 24px 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "rgba(0,189,165,0.08)",
            border: "1px solid rgba(0,189,165,0.2)",
            borderRadius: 999,
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "#00bda5",
            marginBottom: 28,
          }}
        >
          ✨ La plataforma definitiva para administradores de fincas
        </div>

        <h1
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 24,
            background: "linear-gradient(135deg, #18181b 30%, #00bda5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Gestión inteligente de comunidades de vecinos
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "#52525b",
            maxWidth: 600,
            margin: "0 auto 40px",
            lineHeight: 1.7,
          }}
        >
          Una plataforma integral que conecta administradores, vecinos y proveedores para gestionar la comunidad de forma eficiente, transparente y sin papel.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              background: "linear-gradient(135deg, #00bda5 0%, #0891b2 100%)",
              color: "#fff",
              padding: "14px 32px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: "none",
              boxShadow: "0 8px 32px rgba(0,189,165,0.2)",
            }}
          >
            Comenzar ahora →
          </Link>
          <a
            href="#features"
            style={{
              background: "#fafafa",
              border: "1px solid #e4e4e7",
              color: "#18181b",
              padding: "14px 32px",
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              textDecoration: "none",
              transition: "background 0.2s",
            }}
            className="hover:bg-zinc-100"
          >
            Ver funcionalidades
          </a>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: 40,
            justifyContent: "center",
            marginTop: 72,
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "100%", label: "Digital y sin papel" },
            { value: "3", label: "Roles integrados" },
            { value: "∞", label: "Comunidades por AF" },
            { value: "RGPD", label: "Cumplimiento legal" },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #00bda5 0%, #0891b2 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  marginBottom: 4,
                }}
              >
                {value}
              </p>
              <p style={{ fontSize: 13, color: "#71717a" }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: "80px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              marginBottom: 16,
              color: "#18181b"
            }}
          >
            Todo lo que necesita una comunidad
          </h2>
          <p style={{ color: "#52525b", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Funcionalidades diseñadas específicamente para el ecosistema de gestión de fincas español.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map(({ emoji, title, desc }) => (
            <div
              key={title}
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: 16,
                padding: 28,
                transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
              }}
              className="hover:border-[#00bda5]/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-500/5"
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 14,
                  width: 48,
                  height: 48,
                  background: "rgba(0,189,165,0.08)",
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {emoji}
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: "#18181b" }}>{title}</h3>
              <p style={{ color: "#52525b", fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Audience ── */}
      <section
        style={{
          padding: "80px 24px",
          background: "#fafafa",
          borderTop: "1px solid #f4f4f5",
          borderBottom: "1px solid #f4f4f5",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto", textAlign: "center" }}>
          <h2
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
              fontWeight: 800,
              marginBottom: 16,
              color: "#18181b"
            }}
          >
            ¿Para quién es Aconvi?
          </h2>
          <p style={{ color: "#52525b", fontSize: 16, marginBottom: 48 }}>
            Diseñado para los tres protagonistas de la gestión comunitaria.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 20,
            }}
          >
            {AUDIENCE.map(({ emoji, role, desc, color }) => (
              <div
                key={role}
                style={{
                  background: "#ffffff",
                  border: `1px solid ${color}30`,
                  borderRadius: 16,
                  padding: 32,
                  textAlign: "left",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    marginBottom: 16,
                    width: 56,
                    height: 56,
                    background: `${color}15`,
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {emoji}
                </div>
                <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 8, color: "#18181b" }}>
                  {role}
                </h3>
                <p style={{ color: "#52525b", fontSize: 14, lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "100px 24px", textAlign: "center" }}>
        <h2
          style={{
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            marginBottom: 16,
            background: "linear-gradient(135deg, #18181b 30%, #00bda5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Empieza hoy mismo
        </h2>
        <p style={{ color: "#52525b", fontSize: 16, marginBottom: 36 }}>
          Accede al portal y transforma la gestión de tu comunidad.
        </p>
        <Link
          href="/login"
          style={{
            background: "linear-gradient(135deg, #00bda5 0%, #0891b2 100%)",
            color: "#fff",
            padding: "16px 40px",
            borderRadius: 12,
            fontWeight: 700,
            fontSize: 18,
            textDecoration: "none",
            boxShadow: "0 8px 30px rgba(0,189,165,0.25)",
            display: "inline-block",
            transition: "transform 0.2s",
          }}
          className="hover:-translate-y-1"
        >
          Acceso al Portal →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid #f4f4f5",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#71717a", fontSize: 13 }}>
          © {new Date().getFullYear()} Aconvi · Gestión Inteligente de Comunidades ·{" "}
          <Link href="/login" style={{ color: "#00bda5", textDecoration: "none", fontWeight: 500 }}>
            Acceso al Portal
          </Link>
        </p>
      </footer>
    </div>
  );
}
