import Link from "next/link";

export const metadata = {
  title: "Aconvi — Nueva forma de operar comunidades",
  description:
    "Gestionar comunidades no debería ser caótico. Aconvi es la plataforma que organiza el trabajo de administradores, vecinos y proveedores en un solo lugar.",
};

const FEATURES = [
  {
    emoji: "🔧",
    title: "Gestión de Incidencias",
    desc: "Las incidencias no se pierden.\nNo se duplican.\nNo tienes que perseguirlas.",
  },
  {
    emoji: "📢",
    title: "Comunicados",
    desc: "Todos están informados.\nSin repetir mensajes.\nSin perseguir a nadie.",
  },
  {
    emoji: "🏊",
    title: "Reservas",
    desc: "Sin conflictos.\nSin discusiones.\nSin intervención constante.",
  },
  {
    emoji: "🗳️",
    title: "Votaciones",
    desc: "Decisiones claras.\nSin reuniones eternas.\nSin fricción.",
  },
  {
    emoji: "📁",
    title: "Gestión Documental",
    desc: "Todo está donde debe estar.\nAccesible.\nSin búsquedas interminables.",
  },
  {
    emoji: "📅",
    title: "Agenda",
    desc: "Nada se olvida.\nNada depende de memoria.\nTodo sigue su curso.",
  },
];

const AUDIENCE = [
  {
    emoji: "👨‍💼",
    role: "Administradores de Fincas",
    desc: "Menos llamadas.\nMenos control manual.\nMás claridad.",
    color: "#00bda5",
  },
  {
    emoji: "🏘️",
    role: "Propietarios y Vecinos",
    desc: "Saben qué pasa.\nSin preguntar.\nSin insistir.",
    color: "#6366f1",
  },
  {
    emoji: "🔨",
    role: "Proveedores y Técnicos",
    desc: "Saben qué hacer.\nCuándo hacerlo.\nSin fricción.",
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
          ✨ Gestionar comunidades no debería ser caótico.
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
          Pero lo es.
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
          Hay una forma distinta de operar comunidades.{" "}
          <br />Sin llamadas constantes.{" "}
          <br />Sin depender de todo a la vez.
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
            Ver cómo funciona →
          </Link>
        </div>

        {/* Mantras */}
        <div
          style={{
            marginTop: 72,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          {[
            "Nada se pierde.",
            "Nada se queda sin responder.",
            "Todo está bajo control.",
          ].map((text) => (
            <p
              key={text}
              style={{
                fontSize: 20,
                fontWeight: 700,
                background: "linear-gradient(135deg, #00bda5 0%, #0891b2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                margin: 0,
              }}
            >
              {text}
            </p>
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
            El problema no es tener herramientas.
          </h2>
          <p style={{ color: "#52525b", fontSize: 16, maxWidth: 500, margin: "0 auto" }}>
            Es cómo está organizado el trabajo.
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
              <p style={{ color: "#52525b", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{desc}</p>
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
            Cuando el trabajo está organizado, todos lo notan.
          </h2>

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
                <p style={{ color: "#52525b", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{desc}</p>
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
          Esto no va de digitalizar.
        </h2>
        <p style={{ color: "#52525b", fontSize: 16, marginBottom: 36 }}>
          Va de dejar de trabajar así.
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
          Descubrir Aconvi →
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
        <p style={{ color: "#71717a", fontSize: 13, marginBottom: 8 }}>
          © {new Date().getFullYear()} Aconvi · Nueva forma de operar comunidades ·{" "}
          <Link href="/login" style={{ color: "#00bda5", textDecoration: "none", fontWeight: 500 }}>
            Acceso al Portal
          </Link>
        </p>
        <p style={{ color: "#71717a", fontSize: 12 }}>
          <a href="#" style={{ color: "#71717a", textDecoration: "none", marginRight: 12 }}>Condiciones Generales</a>
          <a href="#" style={{ color: "#71717a", textDecoration: "none", marginRight: 12 }}>Política de Privacidad</a>
          <a href="#" style={{ color: "#71717a", textDecoration: "none" }}>Política de Cookies</a>
        </p>
      </footer>
    </div>
  );
}
