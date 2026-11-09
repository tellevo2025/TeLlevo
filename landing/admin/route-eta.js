/*
  route-eta.js — Estima con Google Maps la duración de un viaje en auto.
  Usa DirectionsService, el mismo servicio del cotizador de la landing, y carga el
  script de Google solo cuando se necesita.
*/

const OVER_LIMIT_RETRY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;
const MIN_FUTURE_DEPARTURE_MS = 60 * 1000;

let mapsReady = null;

function loadGoogleMaps(apiKey) {
  mapsReady ??= new Promise((resolve, reject) => {
    window.tellevoMapsReady = resolve;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=tellevoMapsReady`;
    script.async = true;
    script.onerror = () => {
      mapsReady = null;
      reject(new Error('No se pudo cargar Google Maps'));
    };
    document.head.append(script);
  });
  return mapsReady;
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function requestRoute(service, request) {
  try {
    return await service.route(request);
  } catch (err) {
    if (err.code !== 'OVER_QUERY_LIMIT') throw err;
    await wait(OVER_LIMIT_RETRY_MS);
    return service.route(request);
  }
}

/**
 * Calcula cuántos segundos toma el trayecto, pasando por las paradas en orden.
 * Con hora de salida futura considera el tráfico previsto. Las paradas son puntos de
 * paso porque Google no entrega tráfico en rutas con detenciones, y no suman tiempo detenido.
 * @param {{ apiKey: string, origin: string, destination: string, stops: string[], departure: Date }} trip
 * @returns {Promise<number>}
 */
export function estimateDurationSeconds(trip) {
  // Con una clave rechazada Google puede no responder nunca, y eso colgaría la descarga del PDF.
  const timeout = wait(REQUEST_TIMEOUT_MS).then(() => { throw new Error('Google Maps no respondió a tiempo'); });
  return Promise.race([fetchDurationSeconds(trip), timeout]);
}

async function fetchDurationSeconds({ apiKey, origin, destination, stops, departure }) {
  await loadGoogleMaps(apiKey);
  const { DirectionsService, TravelMode, TrafficModel } = google.maps;
  const request = {
    origin,
    destination,
    waypoints: stops.map(location => ({ location, stopover: false })),
    optimizeWaypoints: false,
    travelMode: TravelMode.DRIVING,
    region: 'cl',
  };
  if (departure.getTime() > Date.now() + MIN_FUTURE_DEPARTURE_MS) {
    request.drivingOptions = { departureTime: departure, trafficModel: TrafficModel.BEST_GUESS };
  }

  const response = await requestRoute(new DirectionsService(), request);
  const legs = response.routes[0]?.legs;
  if (!legs?.length) throw new Error('Google no devolvió una ruta');
  return legs.reduce((total, leg) => total + (leg.duration_in_traffic ?? leg.duration).value, 0);
}
