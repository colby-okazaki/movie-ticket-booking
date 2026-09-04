import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Genre, type MovieCatalogEntry } from "../api";
import { useAuth } from "../auth";
import { AdminLayout } from "./AdminLayout";

type MovieForm = {
  title: string;
  description: string;
  posterUrl: string;
  genreIds: string[];
};

const emptyForm: MovieForm = {
  title: "",
  description: "",
  posterUrl: "",
  genreIds: [],
};

export function AdminMoviesPage() {
  const { token } = useAuth();
  const [movies, setMovies] = useState<MovieCatalogEntry[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [form, setForm] = useState<MovieForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newGenre, setNewGenre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [moviesRes, genresRes] = await Promise.all([api.movies(), api.genres()]);
      setMovies(moviesRes.movies);
      setGenres(genresRes.genres);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load movies");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(movie: MovieCatalogEntry) {
    setEditingId(movie.id);
    setForm({
      title: movie.title,
      description: movie.description,
      posterUrl: movie.posterUrl,
      genreIds: movie.genres.map((g) => g.id),
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function toggleGenre(id: string) {
    setForm((prev) => ({
      ...prev,
      genreIds: prev.genreIds.includes(id)
        ? prev.genreIds.filter((g) => g !== id)
        : [...prev.genreIds, id],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (form.genreIds.length === 0) {
      setError("Select at least one genre");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editingId) {
        await api.updateMovie(token, editingId, form);
      } else {
        await api.createMovie(token, form);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string, title: string) {
    if (!token) return;
    if (!window.confirm(`Delete "${title}" and all its showtimes?`)) return;
    setError(null);
    try {
      await api.deleteMovie(token, id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onAddGenre() {
    if (!token || !newGenre.trim()) return;
    setError(null);
    try {
      const { genre } = await api.createGenre(token, { name: newGenre.trim() });
      setGenres((prev) => [...prev, genre].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, genreIds: [...prev.genreIds, genre.id] }));
      setNewGenre("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add genre");
    }
  }

  return (
    <AdminLayout>
      <header className="admin-head">
        <div>
          <h1>Movies</h1>
          <p className="muted">Add titles to the catalog and manage posters and genres.</p>
        </div>
      </header>

      <div className="admin-split">
        <section className="admin-panel">
          <h2 className="admin-panel-title">{editingId ? "Edit movie" : "New movie"}</h2>
          <form className="admin-form" onSubmit={onSubmit}>
            <label>
              <span>Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                required
              />
            </label>
            <label>
              <span>Poster URL</span>
              <input
                type="url"
                value={form.posterUrl}
                onChange={(e) => setForm((f) => ({ ...f, posterUrl: e.target.value }))}
                required
              />
            </label>
            <fieldset className="admin-fieldset">
              <legend>Genres</legend>
              <div className="admin-chip-grid">
                {genres.map((genre) => (
                  <label key={genre.id} className="admin-chip">
                    <input
                      type="checkbox"
                      checked={form.genreIds.includes(genre.id)}
                      onChange={() => toggleGenre(genre.id)}
                    />
                    {genre.name}
                  </label>
                ))}
              </div>
              <div className="admin-inline-add">
                <input
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  placeholder="New genre name"
                />
                <button type="button" className="btn btn-ghost" onClick={() => void onAddGenre()}>
                  Add genre
                </button>
              </div>
            </fieldset>
            {error && <p className="form-error">{error}</p>}
            <div className="admin-form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Saving…" : editingId ? "Update movie" : "Create movie"}
              </button>
              {editingId && (
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Cancel edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="admin-panel">
          <h2 className="admin-panel-title">Catalog ({movies.length})</h2>
          {loading && <p className="muted">Loading…</p>}
          {!loading && movies.length === 0 && <p className="muted">No movies yet.</p>}
          <div className="admin-movie-list">
            {movies.map((movie) => (
              <article key={movie.id} className="admin-movie-row">
                <img src={movie.posterUrl} alt="" className="poster poster-sm" />
                <div>
                  <h3>{movie.title}</h3>
                  <p className="genres">{movie.genres.map((g) => g.name).join(" · ")}</p>
                  <p className="desc">{movie.description}</p>
                  <p className="muted admin-meta">
                    {movie.upcomingShowtimes?.length ?? 0} upcoming showtime
                    {(movie.upcomingShowtimes?.length ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => startEdit(movie)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void onDelete(movie.id, movie.title)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
