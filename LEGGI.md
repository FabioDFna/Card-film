# Carte Film

Gestionale personale per carte collezionabili da film.

- **Fronte**: solo poster
- **Retro**: titolo, titolo italiano, data uscita, paesi (con bandiere), trama, regia e cast principale
- Dati e poster da **TMDB**
- Collezione in `localStorage`
- Export **PNG** (fronte/retro) e **PDF** stampabile 63×88 mm (poker)

## Setup

1. Crea una API key gratuita su [TMDB](https://www.themoviedb.org/settings/api)
2. Copia `.env.example` in `.env` e inserisci la chiave:

```env
VITE_TMDB_API_KEY=la_tua_chiave
```

3. Installa e avvia:

```bash
npm install
npm run dev
```

## Uso

1. Cerca un film
2. I campi si compilano da soli (puoi ritoccarli)
3. Salva in collezione
4. Esporta PNG o PDF quando vuoi stampare
