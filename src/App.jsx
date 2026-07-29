import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./App.css";

const formatearFecha = (fecha) => {
  if (!fecha) return "";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00Z`));
};

const convertirObra = (obra) => ({
  ...obra,
  fecha: formatearFecha(obra.fecha_publicacion),
  imagen: supabase.storage
    .from("obras")
    .getPublicUrl(obra.imagen_path).data.publicUrl,
});

function App() {
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  const [likes, setLikes] = useState({});
  const [informacionVisible, setInformacionVisible] = useState(false);
  const [infoTarjetaVisible, setInfoTarjetaVisible] = useState(null);
  const [indicePortada, setIndicePortada] = useState(0);

  const obraPortada = obras[indicePortada];

  useEffect(() => {
    const cargarObras = async () => {
      setCargando(true);
      setError("");

      const { data, error: errorConsulta } = await supabase
        .from("obras")
        .select(
          "id, titulo, artista, descripcion, tecnica, dimensiones, imagen_path, fecha_publicacion, destacada, created_at",
        )
        .eq("publicada", true)
        .order("destacada", { ascending: false })
        .order("fecha_publicacion", { ascending: false })
        .order("created_at", { ascending: false });

      if (errorConsulta) {
        setError("No fue posible cargar la galería. Intenta nuevamente.");
        setObras([]);
      } else {
        setObras((data ?? []).map(convertirObra));
      }

      setIndicePortada(0);
      setCargando(false);
    };

    cargarObras();
  }, []);

  useEffect(() => {
    if (obras.length <= 1) return undefined;

    const intervalo = window.setInterval(() => {
      setIndicePortada((indiceActual) => (indiceActual + 1) % obras.length);
    }, 7000);

    return () => window.clearInterval(intervalo);
  }, [obras.length]);

  useEffect(() => {
    if (!obraSeleccionada) return undefined;

    const cerrarConEscape = (evento) => {
      if (evento.key === "Escape") {
        setObraSeleccionada(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [obraSeleccionada]);

  const cambiarPortada = (direccion) => {
    setIndicePortada((indiceActual) => {
      if (direccion === "siguiente") {
        return (indiceActual + 1) % obras.length;
      }

      return (indiceActual - 1 + obras.length) % obras.length;
    });
  };

  const darLike = (id) => {
    setLikes((estadoActual) => ({
      ...estadoActual,
      [id]: !estadoActual[id],
    }));
  };

  const abrirObra = (obra) => {
    setObraSeleccionada(obra);
    setInformacionVisible(false);
  };

  const textoPublicaciones = `${obras.length} ${
    obras.length === 1 ? "publicación" : "publicaciones"
  }`;

  return (
    <main>
      <header className="encabezado">
        <a className="logo" href="/">
          PASARELA MILA
        </a>

        <nav>
          <a href="#ultimas">Últimas obras</a>
          <a href="#catalogo">Catálogo</a>
          <span className="artista">DreamSan</span>
        </nav>
      </header>

      {cargando ? (
        <section className="estado-galeria estado-portada">
          <span className="cargador" aria-hidden="true" />
          <p>Cargando galería...</p>
        </section>
      ) : error ? (
        <section className="estado-galeria estado-portada">
          <span className="etiqueta">PASARELA DREAMSAN</span>
          <h1>La galería no está disponible</h1>
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </section>
      ) : obras.length === 0 ? (
        <section className="estado-galeria estado-portada">
          <span className="etiqueta">PASARELA DREAMSAN</span>
          <h1>Próximamente</h1>
          <p>La primera obra está por llegar.</p>
        </section>
      ) : (
        <>
          <section id="ultimas" className="portada">
            <img
              key={obraPortada.id}
              className="portada-imagen animacion-portada"
              src={obraPortada.imagen}
              alt={obraPortada.titulo}
            />

            <div className="portada-sombra" />

            <div className="portada-contenido">
              <span className="etiqueta">
                {obraPortada.destacada
                  ? "OBRA DESTACADA"
                  : "ÚLTIMA PUBLICACIÓN"}
              </span>

              <h1>{obraPortada.titulo}</h1>
              <p>Una obra original de {obraPortada.artista}</p>

              <button type="button" onClick={() => abrirObra(obraPortada)}>
                Ver obra
              </button>
            </div>

            {obras.length > 1 && (
              <>
                <button
                  type="button"
                  className="flecha-portada flecha-izquierda"
                  onClick={() => cambiarPortada("anterior")}
                  aria-label="Obra anterior"
                >
                  ‹
                </button>

                <button
                  type="button"
                  className="flecha-portada flecha-derecha"
                  onClick={() => cambiarPortada("siguiente")}
                  aria-label="Obra siguiente"
                >
                  ›
                </button>

                <div className="indicadores-portada">
                  {obras.map((obra, indice) => (
                    <button
                      type="button"
                      key={obra.id}
                      className={
                        indice === indicePortada
                          ? "indicador activo"
                          : "indicador"
                      }
                      onClick={() => setIndicePortada(indice)}
                      aria-label={`Mostrar ${obra.titulo}`}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <section id="catalogo" className="catalogo">
            <div className="titulo-seccion">
              <div>
                <span>ARCHIVO DIGITAL</span>
                <h2>Obras de DreamSan</h2>
              </div>

              <p>{textoPublicaciones}</p>
            </div>

            <div className="cuadricula">
              {obras.map((obra) => (
                <article className="tarjeta" key={obra.id}>
                  <button
                    type="button"
                    className="imagen-boton"
                    onClick={() => abrirObra(obra)}
                    aria-label={`Abrir ${obra.titulo}`}
                  >
                    <img src={obra.imagen} alt={obra.titulo} loading="lazy" />
                  </button>

                  <div className="acciones">
                    <div className="informacion">
                      <button
                        type="button"
                        className="boton-info"
                        onClick={() =>
                          setInfoTarjetaVisible((idActual) =>
                            idActual === obra.id ? null : obra.id,
                          )
                        }
                        aria-label={`Mostrar información de ${obra.titulo}`}
                        aria-expanded={infoTarjetaVisible === obra.id}
                      >
                        i
                      </button>

                      <div
                        className={`informacion-flotante ${
                          infoTarjetaVisible === obra.id ? "visible" : ""
                        }`}
                      >
                        <strong>{obra.titulo}</strong>
                        <span>Por {obra.artista}</span>
                        <span>{obra.fecha}</span>
                        {obra.tecnica && <span>{obra.tecnica}</span>}
                        {obra.dimensiones && <span>{obra.dimensiones}</span>}
                        {obra.descripcion && <p>{obra.descripcion}</p>}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`boton-like ${
                        likes[obra.id] ? "activo" : ""
                      }`}
                      onClick={() => darLike(obra.id)}
                      aria-label={
                        likes[obra.id] ? "Quitar Me gusta" : "Me gusta"
                      }
                      aria-pressed={Boolean(likes[obra.id])}
                    >
                      {likes[obra.id] ? "♥" : "♡"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {obraSeleccionada && (
        <div
          className="visor"
          role="dialog"
          aria-modal="true"
          aria-label={obraSeleccionada.titulo}
        >
          <button
            type="button"
            className="cerrar"
            onClick={() => setObraSeleccionada(null)}
            aria-label="Cerrar obra"
          >
            ×
          </button>

          <img
            src={obraSeleccionada.imagen}
            alt={obraSeleccionada.titulo}
          />

          <div className="visor-acciones">
            <div className="informacion">
              <button
                type="button"
                className="boton-info"
                onClick={() => setInformacionVisible((visible) => !visible)}
                aria-expanded={informacionVisible}
                aria-label="Mostrar información de la obra"
              >
                i
              </button>

              <div
                className={`informacion-flotante visor-info ${
                  informacionVisible ? "visible" : ""
                }`}
              >
                <strong>{obraSeleccionada.titulo}</strong>
                <span>Por {obraSeleccionada.artista}</span>
                <span>{obraSeleccionada.fecha}</span>
                {obraSeleccionada.tecnica && (
                  <span>{obraSeleccionada.tecnica}</span>
                )}
                {obraSeleccionada.dimensiones && (
                  <span>{obraSeleccionada.dimensiones}</span>
                )}
                {obraSeleccionada.descripcion && (
                  <p>{obraSeleccionada.descripcion}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              className={`boton-like ${
                likes[obraSeleccionada.id] ? "activo" : ""
              }`}
              onClick={() => darLike(obraSeleccionada.id)}
              aria-label={
                likes[obraSeleccionada.id] ? "Quitar Me gusta" : "Me gusta"
              }
              aria-pressed={Boolean(likes[obraSeleccionada.id])}
            >
              {likes[obraSeleccionada.id] ? "♥" : "♡"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;