import type { Address, Coordinates } from '../types';
import { formatFullAddress } from '../utils/format';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    city?: string;
    town?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

// Rate limiting - Nominatim requires max 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds

async function throttleRequest(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

export async function geocodeAddress(address: Address): Promise<Coordinates | null> {
  await throttleRequest();

  const fullAddress = formatFullAddress(address);
  const query = encodeURIComponent(fullAddress + ', Brasil');

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?q=${query}&format=json&limit=1&countrycodes=br`,
      {
        headers: {
          'User-Agent': 'MedVisit App (contact@medvisit.com.br)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const results: NominatimResult[] = await response.json();

    if (results.length === 0) {
      // Try with just city and state
      const fallbackQuery = encodeURIComponent(`${address.city}, ${address.state}, Brasil`);
      const fallbackResponse = await fetch(
        `${NOMINATIM_BASE_URL}/search?q=${fallbackQuery}&format=json&limit=1&countrycodes=br`,
        {
          headers: {
            'User-Agent': 'MedVisit App (contact@medvisit.com.br)'
          }
        }
      );

      if (!fallbackResponse.ok) {
        return null;
      }

      const fallbackResults: NominatimResult[] = await fallbackResponse.json();
      if (fallbackResults.length === 0) {
        return null;
      }

      return {
        latitude: parseFloat(fallbackResults[0].lat),
        longitude: parseFloat(fallbackResults[0].lon)
      };
    }

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon)
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function reverseGeocode(coords: Coordinates): Promise<Address | null> {
  await throttleRequest();

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`,
      {
        headers: {
          'User-Agent': 'MedVisit App (contact@medvisit.com.br)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const result: NominatimResult = await response.json();

    if (!result.address) {
      return null;
    }

    return {
      street: result.address.road || '',
      number: result.address.house_number || '',
      neighborhood: result.address.suburb || '',
      city: result.address.city || result.address.town || '',
      state: result.address.state || '',
      zipCode: result.address.postcode || '',
      fullAddress: result.display_name
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

export async function searchAddress(query: string): Promise<NominatimResult[]> {
  await throttleRequest();

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query + ', Brasil')}&format=json&limit=5&countrycodes=br&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'MedVisit App (contact@medvisit.com.br)'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Address search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Address search error:', error);
    return [];
  }
}

// Get coordinates from CEP using ViaCEP API
export async function getAddressFromCEP(cep: string): Promise<Partial<Address> | null> {
  const cleanCep = cep.replace(/\D/g, '');

  if (cleanCep.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

    if (!response.ok) {
      throw new Error(`CEP lookup failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.erro) {
      return null;
    }

    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
      zipCode: cep
    };
  } catch (error) {
    console.error('CEP lookup error:', error);
    return null;
  }
}
