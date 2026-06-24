type GoogleMapsLocation = {
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function googleMapsSearchUrl(query?: string | null) {
  const trimmed = query?.trim();
  if (!trimmed) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
}

export function googleMapsJobsiteUrl(location: GoogleMapsLocation) {
  const { address, latitude, longitude } = location;
  const hasCoordinates =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  if (hasCoordinates) return googleMapsSearchUrl(`${latitude},${longitude}`);
  return googleMapsSearchUrl(address);
}
