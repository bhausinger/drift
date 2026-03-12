export function getTrackUrl(track) {
  return track.permalink
    ? `https://audius.co${track.permalink}`
    : `https://audius.co/tracks/${track.id}`
}
