#!/usr/bin/env node
// Pull Tree House Spa's Google rating, review count and up to 5 reviews into
// src/data/reviews.json. The homepage renders the rating + a few reviews.
//
// Requires two environment variables:
//   GOOGLE_PLACES_API_KEY  - key from a Google Cloud project with the
//                            Places API (Legacy) enabled
//   GOOGLE_PLACE_ID        - the ChIJ... place ID for Tree House Spa.
//                            Find at https://developers.google.com/maps/documentation/places/web-service/place-id
//
// Run:  GOOGLE_PLACES_API_KEY=... GOOGLE_PLACE_ID=... npm run fetch-reviews
// Then commit the updated src/data/reviews.json. A scheduler can re-run this
// periodically to keep reviews fresh.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = resolve(__filename, '../..')
const OUT = resolve(ROOT, 'src/data/reviews.json')

const apiKey = process.env.GOOGLE_PLACES_API_KEY
const placeId = process.env.GOOGLE_PLACE_ID

if (!apiKey || !placeId) {
  console.error('Missing env. Set GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID, then re-run.')
  process.exit(1)
}

const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total,reviews&reviews_sort=most_relevant&language=en&key=${apiKey}`

const res = await fetch(url)
if (!res.ok) {
  console.error(`Places API request failed: ${res.status} ${res.statusText}`)
  process.exit(1)
}
const body = await res.json()
if (body.status !== 'OK') {
  console.error(`Places API status: ${body.status} ${body.error_message ?? ''}`)
  process.exit(1)
}

const place = body.result ?? {}
const rating = Number(place.rating ?? 0)
const count = Number(place.user_ratings_total ?? 0)

// Keep only 4- and 5-star reviews; strip author photos (we restyle).
const reviews = (place.reviews ?? [])
  .filter((r) => typeof r.rating === 'number' && r.rating >= 4)
  .map((r) => ({
    author: r.author_name,
    rating: r.rating,
    text: r.text ?? '',
    relativeTime: r.relative_time_description ?? '',
    timestamp: r.time ?? 0,
  }))
  .sort((a, b) => b.timestamp - a.timestamp)

const out = { rating, count, reviews, fetchedAt: new Date().toISOString() }
await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log(`Wrote ${reviews.length} reviews (rating ${rating}, ${count} total) to ${OUT}`)
