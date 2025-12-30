import { useEffect, useState, useMemo } from 'react';

interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    name?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

interface CountryMapProps {
  targetCountry: string;
  guessedBorders: string[];
  allBorders: string[];
  gameOver: boolean;
  showOutlines?: boolean;
}

// Map game country names to TopoJSON names where they differ
const nameMapping: Record<string, string> = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
  "Democratic Republic of the Congo": "Dem. Rep. Congo",
  "Republic of the Congo": "Congo",
  "Central African Republic": "Central African Rep.",
  "South Sudan": "S. Sudan",
  "Ivory Coast": "Côte d'Ivoire",
  "Eswatini": "eSwatini",
  "Bosnia and Herzegovina": "Bosnia and Herz.",
  "North Macedonia": "Macedonia",
  "East Timor": "Timor-Leste",
  "Western Sahara": "W. Sahara",
};

// Simple function to project coordinates (Mercator-like for display)
function projectCoordinate(lon: number, lat: number, lonOffset: number = 0): [number, number] {
  // Simple equirectangular projection scaled for SVG
  // lonOffset is used to shift coordinates for antimeridian-crossing polygons
  const adjustedLon = lon + lonOffset;
  const x = (adjustedLon + 180) * (800 / 360);
  const y = (90 - lat) * (400 / 180);
  return [x, y];
}

// Check if a ring crosses the antimeridian (has large longitude jumps)
function crossesAntimeridian(coords: number[][]): boolean {
  for (let i = 1; i < coords.length; i++) {
    const lonDiff = Math.abs(coords[i][0] - coords[i - 1][0]);
    if (lonDiff > 180) return true;
  }
  return false;
}

// Convert coordinates to SVG path, handling antimeridian crossing
function coordsToPath(coords: number[][]): string {
  if (!coords || coords.length === 0) return '';

  // Check if this ring crosses the antimeridian
  const crosses = crossesAntimeridian(coords);

  const points = coords.map(([lon, lat]) => {
    if (crosses && lon < 0) {
      // Shift negative longitudes to positive side (wrap around)
      return projectCoordinate(lon, lat, 360);
    }
    return projectCoordinate(lon, lat);
  });

  if (points.length === 0) return '';

  const [first, ...rest] = points;
  return `M${first[0]},${first[1]} ${rest.map(([x, y]) => `L${x},${y}`).join(' ')} Z`;
}

// Generate SVG path from geometry
function geometryToPath(geometry: GeoJSONFeature['geometry']): string {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as number[][][]).map(ring => coordsToPath(ring)).join(' ');
  } else if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][])
      .map(polygon => polygon.map(ring => coordsToPath(ring)).join(' '))
      .join(' ');
  }
  return '';
}

// Calculate bounding box for a set of countries
function calculateBounds(features: GeoJSONFeature[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  let hasAntimeridianCrossing = false;

  for (const feature of features) {
    const coords = feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : (feature.geometry.coordinates as number[][][][]);

    for (const polygon of coords) {
      for (const ring of polygon) {
        if (crossesAntimeridian(ring)) {
          hasAntimeridianCrossing = true;
        }
        for (const [lon, lat] of ring) {
          // If we have antimeridian crossing, shift negative lons
          const adjustedLon = hasAntimeridianCrossing && lon < 0 ? lon + 360 : lon;
          minLon = Math.min(minLon, adjustedLon);
          maxLon = Math.max(maxLon, adjustedLon);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      }
    }
  }

  const [minX, maxY] = projectCoordinate(minLon, minLat);
  const [maxX, minY] = projectCoordinate(maxLon, maxLat);

  return { minX, minY, maxX, maxY };
}

export function CountryMap({ targetCountry, guessedBorders, allBorders, gameOver, showOutlines = false }: CountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load GeoJSON data
  useEffect(() => {
    const controller = new AbortController();

    async function loadGeoData() {
      try {
        // Use Natural Earth 110m resolution for smaller file size
        const response = await fetch(
          'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
          { signal: controller.signal }
        );

        if (!response.ok) throw new Error('Failed to load map data');

        const topoData = await response.json();

        // Convert TopoJSON to GeoJSON
        const { feature } = await import('topojson-client');
        const geoJSON = feature(topoData, topoData.objects.countries) as unknown as GeoJSONData;

        setGeoData(geoJSON);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Could not load map');
          setLoading(false);
        }
      }
    }

    loadGeoData();
    return () => controller.abort();
  }, []);

  // Get the countries to display
  const countriesToShow = useMemo(() => {
    const countries = [targetCountry, ...guessedBorders];
    if (gameOver) {
      // Show all borders when game is over
      return [...new Set([targetCountry, ...allBorders])];
    }
    if (showOutlines) {
      // Show all borders when outline hint is used
      return [...new Set([targetCountry, ...allBorders])];
    }
    return countries;
  }, [targetCountry, guessedBorders, allBorders, gameOver, showOutlines]);

  // All countries that will eventually be shown (for stable viewBox calculation)
  const allCountriesToConsider = useMemo(() => {
    return [...new Set([targetCountry, ...allBorders])];
  }, [targetCountry, allBorders]);

  // Calculate stable viewBox based on ALL countries (target + all borders)
  const viewBox = useMemo(() => {
    if (!geoData) return '0 0 800 400';

    const allFeatures: GeoJSONFeature[] = [];

    for (const name of allCountriesToConsider) {
      const topoName = nameMapping[name] || name;
      const feature = geoData.features.find(f => {
        const featureName = f.properties.name;
        if (!featureName) return false;
        return featureName === topoName || featureName.toLowerCase() === topoName.toLowerCase();
      });
      if (feature) {
        allFeatures.push(feature);
      }
    }

    if (allFeatures.length === 0) {
      return '0 0 800 400';
    }

    const bounds = calculateBounds(allFeatures);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const paddingX = width * 0.05;
    const paddingY = height * 0.05;

    const finalWidth = width + paddingX * 2;
    const finalHeight = height + paddingY * 2;

    return `${bounds.minX - paddingX} ${bounds.minY - paddingY} ${finalWidth} ${finalHeight}`;
  }, [geoData, allCountriesToConsider]);

  // Get features for displayed countries (only the ones to show)
  const features = useMemo(() => {
    if (!geoData) return [];

    const countryFeatures: { feature: GeoJSONFeature; name: string; isTarget: boolean; isGuessed: boolean; isMissed: boolean; isOutlineHint: boolean }[] = [];

    for (const name of countriesToShow) {
      // Map the game name to TopoJSON name if different
      const topoName = nameMapping[name] || name;

      // Find the feature by country name
      const feature = geoData.features.find(f => {
        const featureName = f.properties.name;
        if (!featureName) return false;
        return featureName === topoName || featureName.toLowerCase() === topoName.toLowerCase();
      });

      if (feature) {
        const isTarget = name === targetCountry;
        const isGuessed = guessedBorders.includes(name);
        const isMissed = gameOver && allBorders.includes(name) && !guessedBorders.includes(name) && !isTarget;
        const isOutlineHint = showOutlines && !gameOver && allBorders.includes(name) && !guessedBorders.includes(name) && !isTarget;

        countryFeatures.push({ feature, name, isTarget, isGuessed, isMissed, isOutlineHint });
      }
    }

    return countryFeatures;
  }, [geoData, countriesToShow, targetCountry, guessedBorders, allBorders, gameOver, showOutlines]);

  if (loading) {
    return (
      <div className="country-map loading">
        <div className="map-loader">Loading map...</div>
      </div>
    );
  }

  if (error || features.length === 0) {
    return null; // Silently fail if map can't be loaded
  }

  return (
    <div className="country-map">
      <svg viewBox={viewBox} className="map-svg">
        {features.map(({ feature, name, isTarget, isGuessed, isMissed, isOutlineHint }) => (
          <path
            key={name}
            d={geometryToPath(feature.geometry)}
            className={`country-path ${isTarget ? 'target' : ''} ${isGuessed ? 'guessed' : ''} ${isMissed ? 'missed' : ''} ${isOutlineHint ? 'outline-hint' : ''}`}
          />
        ))}
      </svg>
    </div>
  );
}
