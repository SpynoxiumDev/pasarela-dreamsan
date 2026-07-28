import { useEffect, useState } from "react";
import "./App.css";

const obras = [
  {
    id: 1,
    titulo: "Redesign Jurassic Park Book",
    artista: "DreamSan",
    fecha: "28 de julio de 2026",
    descripcion:
      "Primera pieza publicada en la galería digital de DreamSan.",
    imagen: "/obras/obra-01.jpg",
  },
];

function App() {
  const [obraSeleccionada, setObraSeleccionada] = useState(null);
  const [likes, setLikes] = useState({});
  const [informacionVisible, setInformacionVisible] = useState(false);
  const [indicePortada, setIndicePortada] = useState(0);

  const obraPortada = obras[indicePortada];

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

  useEffect(() => {
    if(obras.length <= 1) return;

    const intervalo  = setInterval(() => {
      setIndicePortada((indiceActual) => {
        return (indiceActual + 1) % obras.length;
      });
    }, 7000);

    return () => clearInterval(intervalo);
  }, []);


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

      <section id="ultimas" className="portada">
        <img
          key={obraPortada.id}
          className="portada-imagen animacion-portada"
          src={obraPortada.imagen}
          alt={obraPortada.titulo}
        />

        <div className="portada-sombra" />

        <div className="portada-contenido">
          <span className="etiqueta">ÚLTIMA PUBLICACIÓN</span>

          <h1>{obraPortada.titulo}</h1>

          <p>Una obra original de {obraPortada.artista}</p>

          <button onClick={() => abrirObra(obraPortada)}>
            Ver obra
          </button>
        </div>

        {obras.length > 1 && (
          <>
            <button
              className="flecha-portada flecha-izquierda"
              onClick={() => cambiarPortada("anterior")}
              aria-label="Obra anterior"
            >
              ‹
            </button>

            <button
              className="flecha-portada flecha-derecha"
              onClick={() => cambiarPortada("siguiente")}
              aria-label="Obra siguiente"
            >
              ›
            </button>

            <div className="indicadores-portada">
              {obras.map((obra, indice) => (
                <button
                  key={obra.id}
                  className={indice === indicePortada ? "indicador activo" : "indicador"}
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

          <p>{obras.length} publicación</p>
        </div>

        <div className="cuadricula">
          {obras.map((obra) => (
            <article className="tarjeta" key={obra.id}>
              <button
                className="imagen-boton"
                onClick={() => abrirObra(obra)}
                aria-label={`Abrir ${obra.titulo}`}
              >
                <img src={obra.imagen} alt={obra.titulo} />
              </button>

              <div className="acciones">
                <div className="informacion">
                  <button className="boton-info" aria-label="Mostrar información">
                    i
                  </button>

                  <div className="informacion-flotante">
                    <strong>{obra.titulo}</strong>
                    <span>Por {obra.artista}</span>
                    <span>{obra.fecha}</span>
                    <p>{obra.descripcion}</p>
                  </div>
                </div>

                <button
                  className={`boton-like ${likes[obra.id] ? "activo" : ""}`}
                  onClick={() => darLike(obra.id)}
                >
                  {likes[obra.id] ? "♥" : "♡"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {obraSeleccionada && (
        <div className="visor">
          <button
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
                className="boton-info"
                onClick={() => setInformacionVisible(!informacionVisible)}
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
                <p>{obraSeleccionada.descripcion}</p>
              </div>
            </div>

            <button
              className={`boton-like ${
                likes[obraSeleccionada.id] ? "activo" : ""
              }`}
              onClick={() => darLike(obraSeleccionada.id)}
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