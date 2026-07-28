import "./Admin.css";

function Admin() {
  return (
    <main className="admin">
      <section className="admin-login">
        <span className="admin-etiqueta">PANEL PRIVADO</span>

        <h1>DreamSan</h1>

        <p>
          Inicia sesión para publicar y administrar las obras de Pasarela DreamSan.
        </p>

        <form>
          <label>
            Correo electrónico
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              autoComplete="email"
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button type="submit">Iniciar sesión</button>
        </form>

        <a href="/">← Volver a la galería</a>
      </section>
    </main>
  );
}

export default Admin;