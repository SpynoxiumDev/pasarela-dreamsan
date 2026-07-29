import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import "./Admin.css";

const DREAMSAN_UID = "6b1d0e3a-eac9-4c64-acf7-b6b8f8bf8d19";
const MAXIMO_IMAGEN = 30 * 1024 * 1024;
const LADO_MAXIMO_WEBP = 3840;
const CALIDAD_WEBP = 0.9;
const VERSION_PANEL =
  "v2.3 · Ilustración digital · WebP automático · máximo 30 MB";

const FORMATOS_PERMITIDOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const cargarImagen = (archivo) =>
  new Promise((resolve, reject) => {
    const imagen = new Image();
    const url = URL.createObjectURL(archivo);

    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };

    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };

    imagen.src = url;
  });

const convertirAWebp = async (archivo) => {
  const imagen = await cargarImagen(archivo);
  const ladoMayor = Math.max(imagen.naturalWidth, imagen.naturalHeight);
  const escala = Math.min(1, LADO_MAXIMO_WEBP / ladoMayor);
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");

  if (!contexto) {
    throw new Error("Tu navegador no pudo preparar la imagen.");
  }

  canvas.width = ancho;
  canvas.height = alto;
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (resultado) => {
        if (resultado) {
          resolve(resultado);
        } else {
          reject(new Error("Tu navegador no pudo convertir la imagen a WebP."));
        }
      },
      "image/webp",
      CALIDAD_WEBP,
    );
  });

  const nombreSinExtension =
    archivo.name.replace(/\.[^/.]+$/, "").trim() || "obra";

  return new File([blob], `${nombreSinExtension}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
};

const obtenerFechaActual = () => {
  const fecha = new Date();
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
  return fecha.toISOString().slice(0, 10);
};

function IconoImagen() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path d="m5 17 4.2-4.2a1 1 0 0 1 1.4 0l2.2 2.2 1.7-1.7a1 1 0 0 1 1.4 0L20 17.4" />
      <circle cx="15.8" cy="8.2" r="1.7" />
    </svg>
  );
}

function GestorObras({ actualizacion }) {
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [obraEditando, setObraEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(null);

  const cargarObras = async () => {
    setCargando(true);
    setError("");

    const { data, error: errorConsulta } = await supabase
      .from("obras")
      .select("*")
      .order("created_at", { ascending: false });

    if (errorConsulta) {
      setError(`No se pudieron cargar las obras: ${errorConsulta.message}`);
    } else {
      setObras(data ?? []);
    }

    setCargando(false);
  };

  useEffect(() => {
    cargarObras();
  }, [actualizacion]);

  const obtenerUrlImagen = (imagenPath) =>
    supabase.storage.from("obras").getPublicUrl(imagenPath).data.publicUrl;

  const cambiarEstado = async (obra, campo) => {
    setError("");

    const nuevoValor = !obra[campo];
    const { error: errorActualizacion } = await supabase
      .from("obras")
      .update({ [campo]: nuevoValor, updated_at: new Date().toISOString() })
      .eq("id", obra.id);

    if (errorActualizacion) {
      setError(`No se pudo actualizar la obra: ${errorActualizacion.message}`);
      return;
    }

    setObras((obrasActuales) =>
      obrasActuales.map((obraActual) =>
        obraActual.id === obra.id
          ? { ...obraActual, [campo]: nuevoValor }
          : obraActual,
      ),
    );
  };

  const guardarEdicion = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setError("");

    const datos = new FormData(evento.currentTarget);
    const nuevaImagen = datos.get("imagen");
    let nuevaImagenPath = null;

    if (nuevaImagen?.size) {
      if (!FORMATOS_PERMITIDOS[nuevaImagen.type]) {
        setError("La nueva imagen debe ser JPG, PNG o WebP.");
        setGuardando(false);
        return;
      }

      if (nuevaImagen.size > MAXIMO_IMAGEN) {
        setError("La nueva imagen no puede superar los 30 MB.");
        setGuardando(false);
        return;
      }

      const {
        data: { user },
        error: errorUsuario,
      } = await supabase.auth.getUser();

      if (errorUsuario || !user) {
        setError("Tu sesión venció. Vuelve a iniciar sesión.");
        setGuardando(false);
        return;
      }

      let imagenOptimizada;

      try {
        imagenOptimizada = await convertirAWebp(nuevaImagen);
      } catch (errorConversion) {
        setError(errorConversion.message);
        setGuardando(false);
        return;
      }

      if (imagenOptimizada.size > MAXIMO_IMAGEN) {
        setError(
          "La imagen convertida continúa superando los 30 MB. Intenta exportarla con menor resolución.",
        );
        setGuardando(false);
        return;
      }

      nuevaImagenPath = `${user.id}/${crypto.randomUUID()}.webp`;

      const { error: errorSubida } = await supabase.storage
        .from("obras")
        .upload(nuevaImagenPath, imagenOptimizada, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (errorSubida) {
        setError(`No se pudo subir la nueva imagen: ${errorSubida.message}`);
        setGuardando(false);
        return;
      }
    }

    const cambios = {
      titulo: String(datos.get("titulo")).trim(),
      descripcion: String(datos.get("descripcion")).trim(),
      fecha_publicacion: datos.get("fecha_publicacion"),
      publicada: datos.get("publicada") === "on",
      destacada: datos.get("destacada") === "on",
      updated_at: new Date().toISOString(),
    };

    if (nuevaImagenPath) {
      cambios.imagen_path = nuevaImagenPath;
    }

    const { data, error: errorActualizacion } = await supabase
      .from("obras")
      .update(cambios)
      .eq("id", obraEditando.id)
      .select()
      .single();

    if (errorActualizacion) {
      if (nuevaImagenPath) {
        await supabase.storage.from("obras").remove([nuevaImagenPath]);
      }
      setError(`No se pudieron guardar los cambios: ${errorActualizacion.message}`);
    } else {
      if (nuevaImagenPath) {
        await supabase.storage
          .from("obras")
          .remove([obraEditando.imagen_path]);
      }
      setObras((obrasActuales) =>
        obrasActuales.map((obra) => (obra.id === data.id ? data : obra)),
      );
      setObraEditando(null);
    }

    setGuardando(false);
  };

  const eliminarObra = async (obra) => {
    const confirmada = window.confirm(
      `¿Seguro que quieres eliminar “${obra.titulo}”? Esta acción no se puede deshacer.`,
    );

    if (!confirmada) return;

    setEliminando(obra.id);
    setError("");

    const { error: errorEliminacion } = await supabase
      .from("obras")
      .delete()
      .eq("id", obra.id);

    if (errorEliminacion) {
      setError(`No se pudo eliminar la obra: ${errorEliminacion.message}`);
      setEliminando(null);
      return;
    }

    const { error: errorImagen } = await supabase.storage
      .from("obras")
      .remove([obra.imagen_path]);

    if (errorImagen) {
      setError(
        "La publicación se eliminó, pero no fue posible borrar su imagen almacenada.",
      );
    }

    setObras((obrasActuales) =>
      obrasActuales.filter((obraActual) => obraActual.id !== obra.id),
    );
    setEliminando(null);
  };

  if (cargando) {
    return (
      <section className="gestor-obras estado-gestor">
        <p>Cargando obras...</p>
      </section>
    );
  }

  return (
    <section className="gestor-obras">
      <div className="gestor-encabezado">
        <div>
          <span className="admin-etiqueta">COLECCIÓN</span>
          <h2>Administrar obras</h2>
        </div>
        <p>
          {obras.length} {obras.length === 1 ? "obra registrada" : "obras registradas"}
        </p>
      </div>

      {error && (
        <p className="formulario-mensaje error mensaje-gestor" role="alert">
          {error}
        </p>
      )}

      {obras.length === 0 ? (
        <div className="gestor-vacio">
          <span className="icono-imagen">
            <IconoImagen />
          </span>
          <h3>Aún no hay obras</h3>
          <p>Cuando publiques la primera, podrás administrarla desde aquí.</p>
        </div>
      ) : (
        <div className="lista-obras">
          {obras.map((obra) => (
            <article className="tarjeta-admin" key={obra.id}>
              <div className="tarjeta-admin-imagen">
                <img src={obtenerUrlImagen(obra.imagen_path)} alt={obra.titulo} />
                <div className="estado-obra">
                  <span className={obra.publicada ? "publicada" : "borrador"}>
                    {obra.publicada ? "Publicada" : "Borrador"}
                  </span>
                  {obra.destacada && <span className="destacada">Destacada</span>}
                </div>
              </div>

              <div className="tarjeta-admin-contenido">
                <div>
                  <h3>{obra.titulo}</h3>
                  <p>{obra.descripcion || "Sin descripción"}</p>
                </div>

                <div className="acciones-obra">
                  <button type="button" onClick={() => setObraEditando(obra)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(obra, "publicada")}
                  >
                    {obra.publicada ? "Ocultar" : "Publicar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => cambiarEstado(obra, "destacada")}
                  >
                    {obra.destacada ? "Quitar destaque" : "Destacar"}
                  </button>
                  <button
                    className="boton-eliminar"
                    type="button"
                    disabled={eliminando === obra.id}
                    onClick={() => eliminarObra(obra)}
                  >
                    {eliminando === obra.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {obraEditando && (
        <div
          className="modal-edicion"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-edicion"
        >
          <form className="edicion-obra" onSubmit={guardarEdicion}>
            <div className="edicion-encabezado">
              <div>
                <span className="admin-etiqueta">EDITAR PUBLICACIÓN</span>
                <h2 id="titulo-edicion">{obraEditando.titulo}</h2>
              </div>
              <button
                className="cerrar-edicion"
                type="button"
                onClick={() => setObraEditando(null)}
                aria-label="Cerrar edición"
              >
                ×
              </button>
            </div>

            <div className="campos-editor">
              <label className="campo campo-completo">
                <span>Título de la obra</span>
                <input
                  name="titulo"
                  type="text"
                  maxLength="150"
                  defaultValue={obraEditando.titulo}
                  required
                />
              </label>

              <label className="campo campo-completo">
                <span>Descripción</span>
                <textarea
                  name="descripcion"
                  maxLength="2000"
                  defaultValue={obraEditando.descripcion}
                />
              </label>

              <label className="campo campo-completo">
                <span>Fecha de publicación</span>
                <input
                  name="fecha_publicacion"
                  type="date"
                  defaultValue={obraEditando.fecha_publicacion}
                  required
                />
              </label>

              <label className="campo campo-completo">
                <span>Reemplazar imagen (opcional)</span>
                <input
                  name="imagen"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
                <small>
                  JPG, PNG o WebP · máximo 30 MB. Se convertirá
                  automáticamente a WebP.
                </small>
              </label>
            </div>

            <div className="edicion-opciones">
              <label>
                <input
                  name="publicada"
                  type="checkbox"
                  defaultChecked={obraEditando.publicada}
                />
                Visible en la galería
              </label>
              <label>
                <input
                  name="destacada"
                  type="checkbox"
                  defaultChecked={obraEditando.destacada}
                />
                Obra destacada
              </label>
            </div>

            <div className="edicion-acciones">
              <button type="button" onClick={() => setObraEditando(null)}>
                Cancelar
              </button>
              <button className="boton-guardar" type="submit" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function FormularioObra({ onObraCreada }) {
  const inputImagen = useRef(null);
  const [imagen, setImagen] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const [fecha, setFecha] = useState(obtenerFechaActual());
  const [publicada, setPublicada] = useState(true);
  const [destacada, setDestacada] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState("");

  useEffect(() => {
    if (!imagen) {
      setVistaPrevia("");
      return undefined;
    }

    const url = URL.createObjectURL(imagen);
    setVistaPrevia(url);

    return () => URL.revokeObjectURL(url);
  }, [imagen]);

  const mostrarMensaje = (texto, tipo = "error") => {
    setMensaje(texto);
    setTipoMensaje(tipo);
  };

  const validarImagen = (archivo) => {
    if (!archivo || archivo.size === 0) {
      mostrarMensaje("Debes seleccionar una imagen.");
      return false;
    }

    if (!FORMATOS_PERMITIDOS[archivo.type]) {
      mostrarMensaje("La imagen debe ser JPG, PNG o WebP.");
      return false;
    }

    if (archivo.size > MAXIMO_IMAGEN) {
      mostrarMensaje("La imagen no puede superar los 30 MB.");
      return false;
    }

    return true;
  };

  const seleccionarImagen = (archivo) => {
    setMensaje("");
    setTipoMensaje("");

    if (validarImagen(archivo)) {
      setImagen(archivo);
    }
  };

  const soltarImagen = (evento) => {
    evento.preventDefault();
    setArrastrando(false);
    seleccionarImagen(evento.dataTransfer.files?.[0]);
  };

  const publicarObra = async (evento) => {
    evento.preventDefault();

    if (!validarImagen(imagen)) return;

    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    setGuardando(true);
    setMensaje("");
    setTipoMensaje("");

    let imagenPath = null;

    try {
      const {
        data: { user },
        error: errorUsuario,
      } = await supabase.auth.getUser();

      if (errorUsuario || !user) {
        throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
      }

      mostrarMensaje("Optimizando la imagen a WebP...", "proceso");
      const imagenOptimizada = await convertirAWebp(imagen);

      if (imagenOptimizada.size > MAXIMO_IMAGEN) {
        throw new Error(
          "La imagen convertida continúa superando los 30 MB. Intenta exportarla con menor resolución.",
        );
      }

      mostrarMensaje(
        `Imagen optimizada: ${(imagen.size / 1024 / 1024).toFixed(2)} MB → ${(
          imagenOptimizada.size /
          1024 /
          1024
        ).toFixed(2)} MB en WebP.`,
        "proceso",
      );

      imagenPath = `${user.id}/${crypto.randomUUID()}.webp`;

      const { error: errorImagen } = await supabase.storage
        .from("obras")
        .upload(imagenPath, imagenOptimizada, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: false,
        });

      if (errorImagen) {
        throw new Error(`No se pudo subir la imagen: ${errorImagen.message}`);
      }

      const { error: errorObra } = await supabase.from("obras").insert({
        titulo: String(datos.get("titulo")).trim(),
        artista: "DreamSan",
        descripcion: String(datos.get("descripcion")).trim(),
        imagen_path: imagenPath,
        fecha_publicacion: fecha,
        destacada,
        publicada,
      });

      if (errorObra) {
        await supabase.storage.from("obras").remove([imagenPath]);
        throw new Error(`No se pudo guardar la obra: ${errorObra.message}`);
      }

      formulario.reset();
      setImagen(null);
      setFecha(obtenerFechaActual());
      setPublicada(true);
      setDestacada(false);
      mostrarMensaje("La obra se publicó correctamente.", "exito");
      onObraCreada?.();
    } catch (error) {
      mostrarMensaje(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="formulario-obra">
      <div className="formulario-obra-titulo">
        <div>
          <span className="admin-etiqueta">NUEVA PUBLICACIÓN</span>
          <h2>Agrega una nueva obra</h2>
        </div>
        <p>
          Completa la información y revisa cómo se verá la imagen antes de
          publicarla.
        </p>
      </div>

      <form className="editor-publicacion" onSubmit={publicarObra}>
        <section className="columna-imagen" aria-label="Imagen de la obra">
          <div className="encabezado-bloque">
            <span className="numero-bloque">01</span>
            <div>
              <h3>Imagen principal</h3>
              <p>Será la protagonista de la publicación.</p>
            </div>
          </div>

          <div
            className={`zona-carga ${vistaPrevia ? "con-imagen" : ""} ${
              arrastrando ? "arrastrando" : ""
            }`}
            onClick={() => inputImagen.current?.click()}
            onDragEnter={(evento) => {
              evento.preventDefault();
              setArrastrando(true);
            }}
            onDragOver={(evento) => evento.preventDefault()}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltarImagen}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" || evento.key === " ") {
                inputImagen.current?.click();
              }
            }}
            role="button"
            tabIndex="0"
          >
            <input
              ref={inputImagen}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(evento) => seleccionarImagen(evento.target.files?.[0])}
              tabIndex="-1"
            />

            {vistaPrevia ? (
              <>
                <img src={vistaPrevia} alt="Vista previa de la obra" />
                <div className="cambiar-imagen">
                  <span>Cambiar imagen</span>
                </div>
              </>
            ) : (
              <div className="zona-carga-vacia">
                <span className="icono-imagen">
                  <IconoImagen />
                </span>
                <strong>Arrastra tu obra aquí</strong>
                <span>o haz clic para explorar tus archivos</span>
                <small>JPG, PNG o WebP · máximo 30 MB</small>
                <small>Conversión automática a WebP en alta calidad</small>
              </div>
            )}
          </div>

          {imagen && (
            <div className="archivo-seleccionado">
              <span>{imagen.name}</span>
              <small>{(imagen.size / 1024 / 1024).toFixed(2)} MB</small>
            </div>
          )}
        </section>

        <div className="columna-editor">
          <section className="bloque-editor">
            <div className="encabezado-bloque">
              <span className="numero-bloque">02</span>
              <div>
                <h3>Información de la obra</h3>
                <p>Cuenta la historia detrás de la pieza.</p>
              </div>
            </div>

            <div className="campos-editor">
              <label className="campo campo-completo">
                <span>Título de la obra</span>
                <input
                  name="titulo"
                  type="text"
                  maxLength="150"
                  placeholder="Ej. Jardín de medianoche"
                  required
                />
              </label>

              <label className="campo campo-completo">
                <span>Descripción</span>
                <textarea
                  name="descripcion"
                  rows="5"
                  maxLength="2000"
                  placeholder="Describe la inspiración, el proceso o la historia de esta obra..."
                />
              </label>

              <label className="campo campo-completo">
                <span>Fecha de publicación</span>
                <input
                  name="fecha_publicacion"
                  type="date"
                  value={fecha}
                  onChange={(evento) => setFecha(evento.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <section className="bloque-editor bloque-ajustes">
            <div className="encabezado-bloque">
              <span className="numero-bloque">03</span>
              <div>
                <h3>Ajustes de publicación</h3>
                <p>Decide cómo aparecerá en la galería.</p>
              </div>
            </div>

            <div className="lista-ajustes">
              <label className="ajuste-publicacion">
                <span>
                  <strong>Publicar ahora</strong>
                  <small>La obra será visible en la galería pública.</small>
                </span>
                <input
                  name="publicada"
                  type="checkbox"
                  checked={publicada}
                  onChange={(evento) => setPublicada(evento.target.checked)}
                />
                <i aria-hidden="true" />
              </label>

              <label className="ajuste-publicacion">
                <span>
                  <strong>Destacar obra</strong>
                  <small>Aparecerá con mayor protagonismo en la portada.</small>
                </span>
                <input
                  name="destacada"
                  type="checkbox"
                  checked={destacada}
                  onChange={(evento) => setDestacada(evento.target.checked)}
                />
                <i aria-hidden="true" />
              </label>
            </div>
          </section>

          {mensaje && (
            <p className={`formulario-mensaje ${tipoMensaje}`} role="status">
              {mensaje}
            </p>
          )}

          <div className="acciones-formulario">
            <span>
              {publicada
                ? "Se publicará inmediatamente"
                : "Se guardará como borrador"}
            </span>
            <button
              className="boton-publicar"
              type="submit"
              disabled={guardando}
            >
              {guardando ? "Optimizando y publicando..." : "Publicar obra"}
              {!guardando && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function Admin() {
  const [sesion, setSesion] = useState(null);
  const [verificando, setVerificando] = useState(true);
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [vistaPanel, setVistaPanel] = useState("obras");
  const [actualizacionObras, setActualizacionObras] = useState(0);

  useEffect(() => {
    let componenteActivo = true;

    const comprobarSesion = async () => {
      const { data } = await supabase.auth.getSession();

      if (componenteActivo) {
        setSesion(data.session);
        setVerificando(false);
      }
    };

    comprobarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
      setVerificando(false);
    });

    return () => {
      componenteActivo = false;
      subscription.unsubscribe();
    };
  }, []);

  const iniciarSesion = async (evento) => {
    evento.preventDefault();
    setCargando(true);
    setMensaje("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (error) {
      setMensaje("El correo o la contraseña son incorrectos.");
      setCargando(false);
      return;
    }

    if (data.user.id !== DREAMSAN_UID) {
      await supabase.auth.signOut();
      setMensaje("Esta cuenta no tiene permiso para administrar la galería.");
      setCargando(false);
      return;
    }

    setCorreo("");
    setContrasena("");
    setCargando(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  if (verificando) {
    return (
      <main className="admin">
        <p className="admin-cargando">Verificando sesión...</p>
      </main>
    );
  }

  if (sesion?.user.id === DREAMSAN_UID) {
    return (
      <main className="admin admin-autenticado">
        <section className="admin-panel">
          <header className="admin-panel-encabezado">
            <div>
              <span className="admin-etiqueta">ESTUDIO DIGITAL</span>
              <h1>DreamSan</h1>
              <p>Crea y administra las obras de tu pasarela.</p>
              <small className="version-panel">{VERSION_PANEL}</small>
            </div>

            <div className="acciones-panel">
              <a href="/">Ver galería</a>
              <button
                className="boton-sesion"
                type="button"
                onClick={cerrarSesion}
              >
                Cerrar sesión
              </button>
            </div>
          </header>

          <nav className="navegacion-panel" aria-label="Secciones del panel">
            <button
              className={vistaPanel === "obras" ? "activo" : ""}
              type="button"
              onClick={() => setVistaPanel("obras")}
            >
              Administrar obras
            </button>
            <button
              className={vistaPanel === "crear" ? "activo" : ""}
              type="button"
              onClick={() => setVistaPanel("crear")}
            >
              Nueva obra
            </button>
          </nav>

          {vistaPanel === "obras" ? (
            <GestorObras actualizacion={actualizacionObras} />
          ) : (
            <FormularioObra
              onObraCreada={() => {
                setActualizacionObras((valor) => valor + 1);
                setVistaPanel("obras");
              }}
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="admin">
      <section className="admin-login">
        <span className="admin-etiqueta">PANEL PRIVADO</span>
        <h1>DreamSan</h1>
        <p>
          Inicia sesión para publicar y administrar las obras de Pasarela
          DreamSan.
        </p>

        <form onSubmit={iniciarSesion}>
          <label>
            Correo electrónico
            <input
              type="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              placeholder="correo@ejemplo.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={contrasena}
              onChange={(evento) => setContrasena(evento.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {mensaje && <p className="admin-error">{mensaje}</p>}

          <button type="submit" disabled={cargando}>
            {cargando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <a href="/">← Volver a la galería</a>
      </section>
    </main>
  );
}

export default Admin;