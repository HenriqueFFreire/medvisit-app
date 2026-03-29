import type { Coordinates, Doctor, Pharmacy, ScheduledVisit, WorkingHours } from '../types';
import { PERIOD_TIMES } from '../types';

const OSRM_BASE_URL = 'https://router.project-osrm.org';

// Get start and end time for a working hour entry based on period
export function getWorkingHourTimes(wh: WorkingHours): { startTime: string; endTime: string } {
  // If legacy format with startTime/endTime, use those
  if (wh.startTime && wh.endTime && !wh.period) {
    return { startTime: wh.startTime, endTime: wh.endTime };
  }

  const period = wh.period || 'M';

  if (period === 'AG' && wh.specificTime) {
    // For scheduled appointments, create a 2-hour window around the specific time
    const [hours, minutes] = wh.specificTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes - 30; // 30 min before
    const endMinutes = hours * 60 + minutes + 90; // 90 min after
    return {
      startTime: formatMinutesToTimeStr(Math.max(0, startMinutes)),
      endTime: formatMinutesToTimeStr(Math.min(23 * 60 + 59, endMinutes))
    };
  }

  // Use period times
  return {
    startTime: PERIOD_TIMES[period].start || '08:00',
    endTime: PERIOD_TIMES[period].end || '18:00'
  };
}

function formatMinutesToTimeStr(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

interface OSRMRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][];
  };
}

interface OSRMResponse {
  code: string;
  routes: OSRMRoute[];
}

// Calculate haversine distance between two points (fallback when offline)
export function haversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
    Math.cos(toRad(coord2.latitude)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Estimate travel time based on distance (average 30 km/h in urban areas)
export function estimateTravelTime(distanceKm: number): number {
  const averageSpeedKmH = 30;
  return Math.round((distanceKm / averageSpeedKmH) * 60); // Return minutes
}

// Get route between two points using OSRM
export async function getRoute(
  origin: Coordinates,
  destination: Coordinates
): Promise<{ distance: number; duration: number } | null> {
  try {
    const response = await fetch(
      `${OSRM_BASE_URL}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false`
    );

    if (!response.ok) {
      throw new Error(`OSRM request failed: ${response.status}`);
    }

    const data: OSRMResponse = await response.json();

    if (data.code !== 'Ok' || data.routes.length === 0) {
      return null;
    }

    return {
      distance: data.routes[0].distance / 1000, // Convert to km
      duration: Math.round(data.routes[0].duration / 60) // Convert to minutes
    };
  } catch (error) {
    console.error('OSRM routing error:', error);
    // Fallback to haversine
    const distance = haversineDistance(origin, destination);
    return {
      distance,
      duration: estimateTravelTime(distance)
    };
  }
}

// Get distance matrix for multiple points
export async function getDistanceMatrix(
  coordinates: Coordinates[]
): Promise<number[][] | null> {
  if (coordinates.length < 2) {
    return null;
  }

  try {
    const coordsString = coordinates
      .map(c => `${c.longitude},${c.latitude}`)
      .join(';');

    const response = await fetch(
      `${OSRM_BASE_URL}/table/v1/driving/${coordsString}?annotations=distance`
    );

    if (!response.ok) {
      throw new Error(`OSRM table request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok') {
      return null;
    }

    // Convert distances from meters to km
    return data.distances.map((row: number[]) =>
      row.map((d: number) => d / 1000)
    );
  } catch (error) {
    console.error('OSRM distance matrix error:', error);
    // Fallback to haversine distances
    return coordinates.map(c1 =>
      coordinates.map(c2 => haversineDistance(c1, c2))
    );
  }
}

// Get region key for a doctor (neighborhood + city)
export function getDoctorRegion(doctor: Doctor): string {
  return `${doctor.address.neighborhood}-${doctor.address.city}`.toLowerCase();
}

// Group doctors by region
export function groupDoctorsByRegion(doctors: Doctor[]): Map<string, Doctor[]> {
  const regions = new Map<string, Doctor[]>();

  for (const doctor of doctors) {
    const region = getDoctorRegion(doctor);
    if (!regions.has(region)) {
      regions.set(region, []);
    }
    regions.get(region)!.push(doctor);
  }

  return regions;
}

// Get doctors available on a specific day of week
export function getDoctorsAvailableOnDay(doctors: Doctor[], dayOfWeek: number): Doctor[] {
  return doctors.filter(doctor =>
    doctor.workingHours.some(wh => wh.dayOfWeek === dayOfWeek && wh.period != null)
  );
}

// Nearest Neighbor algorithm for route optimization within a region
export function optimizeRouteNearestNeighbor(
  doctors: Doctor[],
  startingPoint?: Coordinates
): Doctor[] {
  if (doctors.length <= 1) {
    return doctors;
  }

  const validDoctors = doctors.filter(d => d.coordinates);
  if (validDoctors.length === 0) {
    return doctors;
  }

  const visited = new Set<string>();
  const result: Doctor[] = [];

  // Start from the first doctor or from a starting point
  let currentPoint: Coordinates = startingPoint || validDoctors[0].coordinates!;

  if (!startingPoint) {
    result.push(validDoctors[0]);
    visited.add(validDoctors[0].id);
  }

  while (result.length < validDoctors.length) {
    let nearestDoctor: Doctor | null = null;
    let nearestDistance = Infinity;

    for (const doctor of validDoctors) {
      if (visited.has(doctor.id) || !doctor.coordinates) {
        continue;
      }

      const distance = haversineDistance(currentPoint, doctor.coordinates);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDoctor = doctor;
      }
    }

    if (nearestDoctor) {
      result.push(nearestDoctor);
      visited.add(nearestDoctor.id);
      currentPoint = nearestDoctor.coordinates!;
    }
  }

  // Add doctors without coordinates at the end
  const doctorsWithoutCoords = doctors.filter(d => !d.coordinates);
  return [...result, ...doctorsWithoutCoords];
}

// Check if a doctor is available at a given time
export function isDoctorAvailable(
  doctor: Doctor,
  dayOfWeek: number,
  time: string
): boolean {
  const schedule = doctor.workingHours.find(wh => wh.dayOfWeek === dayOfWeek && wh.period != null);

  if (!schedule) {
    return false;
  }

  const { startTime, endTime } = getWorkingHourTimes(schedule);
  return time >= startTime && time <= endTime;
}

// Interface for weekly route distribution
export interface WeeklyRouteDistribution {
  [dayOfWeek: number]: Doctor[];
}

// Generate optimized weekly distribution based on region and availability
export function generateWeeklyDistribution(
  doctors: Doctor[],
  visitsPerDay: number = 11
): WeeklyRouteDistribution {
  const distribution: WeeklyRouteDistribution = {
    1: [], // Monday
    2: [], // Tuesday
    3: [], // Wednesday
    4: [], // Thursday
    5: [], // Friday
  };

  // Group doctors by region
  const regionGroups = groupDoctorsByRegion(doctors);

  // Sort regions by number of doctors (largest first)
  const sortedRegions = Array.from(regionGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // Track which doctors have been assigned
  const assignedDoctors = new Set<string>();

  // For each region, try to assign all doctors to the same day if possible
  for (const [, regionDoctors] of sortedRegions) {
    // Find the best day for this region based on:
    // 1. Doctor availability
    // 2. Current day load (prefer days with fewer visits)

    const dayScores: { day: number; available: Doctor[]; score: number }[] = [];

    for (let day = 1; day <= 5; day++) {
      const availableDoctors = regionDoctors.filter(
        d => !assignedDoctors.has(d.id) && (
          d.workingHours.length === 0 ||
          d.workingHours.some(wh => wh.dayOfWeek === day && wh.period != null)
        )
      );

      const currentLoad = distribution[day].length;
      const remainingCapacity = visitsPerDay - currentLoad;

      // Score: prioritize days where more doctors are available and have capacity
      const score = Math.min(availableDoctors.length, remainingCapacity) * 10 - currentLoad;

      dayScores.push({ day, available: availableDoctors, score });
    }

    // Sort by score (highest first)
    dayScores.sort((a, b) => b.score - a.score);

    // Assign doctors to days
    for (const { day, available } of dayScores) {
      const remainingCapacity = visitsPerDay - distribution[day].length;
      if (remainingCapacity <= 0) continue;

      const toAssign = available
        .filter(d => !assignedDoctors.has(d.id))
        .slice(0, remainingCapacity);

      for (const doctor of toAssign) {
        distribution[day].push(doctor);
        assignedDoctors.add(doctor.id);
      }
    }
  }

  // Handle any remaining unassigned doctors
  const unassignedDoctors = doctors.filter(d => !assignedDoctors.has(d.id));

  for (const doctor of unassignedDoctors) {
    let bestDay: number | null = null;
    let minLoad = Infinity;

    for (let day = 1; day <= 5; day++) {
      const isAvailable =
        doctor.workingHours.length === 0 ||
        doctor.workingHours.some(wh => wh.dayOfWeek === day && wh.period != null);
      const currentLoad = distribution[day].length;

      if (isAvailable && currentLoad < minLoad && currentLoad < visitsPerDay) {
        minLoad = currentLoad;
        bestDay = day;
      }
    }

    // Only assign if a valid available day was found
    if (bestDay !== null) {
      distribution[bestDay].push(doctor);
      assignedDoctors.add(doctor.id);
    }
  }

  // Sort by period (morning first, then afternoon) and optimize route within each period group
  for (let day = 1; day <= 5; day++) {
    const morning = optimizeRouteNearestNeighbor(
      distribution[day].filter(d => {
        const wh = d.workingHours.find(w => w.dayOfWeek === day && w.period != null);
        return !wh || wh.period === 'M' || wh.period === 'MT' || wh.period === 'AG';
      })
    );
    const afternoon = optimizeRouteNearestNeighbor(
      distribution[day].filter(d => {
        const wh = d.workingHours.find(w => w.dayOfWeek === day && w.period != null);
        return wh?.period === 'T';
      })
    );
    distribution[day] = [...morning, ...afternoon];
  }

  return distribution;
}

// Generate schedule for a day with optimized route
export function generateDaySchedule(
  doctors: Doctor[],
  date: Date,
  visitsPerDay: number,
  visitDuration: number,
  workStartTime: string,
  workEndTime: string,
  minimumInterval: number
): ScheduledVisit[] {
  const dayOfWeek = date.getDay();

  // Filter doctors available on this day
  const availableDoctors = doctors.filter(doctor =>
    doctor.workingHours.length === 0 ||
    doctor.workingHours.some(wh => wh.dayOfWeek === dayOfWeek && wh.period != null)
  );

  // Optimize route order
  const orderedDoctors = optimizeRouteNearestNeighbor(availableDoctors.slice(0, visitsPerDay));

  // Calculate schedule
  const visits: ScheduledVisit[] = [];
  let currentTime = parseTime(workStartTime);
  const endTime = parseTime(workEndTime);

  for (let i = 0; i < orderedDoctors.length && i < visitsPerDay; i++) {
    const doctor = orderedDoctors[i];
    const doctorSchedule = doctor.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);

    if (!doctorSchedule) continue;

    // Get doctor's working hours using new period format
    const doctorTimes = getWorkingHourTimes(doctorSchedule);

    // Adjust start time if doctor starts later
    const doctorStartTime = parseTime(doctorTimes.startTime);
    if (currentTime < doctorStartTime) {
      currentTime = doctorStartTime;
    }

    // Check if we can fit this visit within working hours
    if (currentTime + visitDuration > endTime) {
      break;
    }

    // Check if within doctor's hours
    const doctorEndTime = parseTime(doctorTimes.endTime);
    if (currentTime + visitDuration > doctorEndTime) {
      continue; // Skip this doctor
    }

    // Calculate travel time from previous location
    let travelTime = 0;
    let distance = 0;

    if (i > 0 && orderedDoctors[i - 1].coordinates && doctor.coordinates) {
      distance = haversineDistance(orderedDoctors[i - 1].coordinates!, doctor.coordinates);
      travelTime = estimateTravelTime(distance);
    }

    const scheduledTime = formatMinutesToTime(currentTime);
    const estimatedEndTime = formatMinutesToTime(currentTime + visitDuration);

    visits.push({
      id: `${date.toISOString()}-${doctor.id}`,
      dailyScheduleId: '',
      doctorId: doctor.id,
      doctor,
      order: i + 1,
      scheduledTime,
      estimatedEndTime,
      estimatedTravelTime: travelTime,
      estimatedDistance: distance,
      status: 'pending'
    });

    // Move to next time slot
    currentTime += visitDuration + minimumInterval + travelTime;
  }

  return visits;
}

// Generate schedule from pre-assigned doctors (for drag & drop)
export function generateScheduleFromDoctors(
  doctors: Doctor[],
  date: Date,
  visitDuration: number,
  workStartTime: string,
  workEndTime: string,
  minimumInterval: number
): ScheduledVisit[] {
  const dayOfWeek = date.getDay();

  // Calculate schedule
  const visits: ScheduledVisit[] = [];
  let currentTime = parseTime(workStartTime);
  const endTime = parseTime(workEndTime);

  // Only keep doctors that work on this day (or have no working hours configured)
  const filteredDoctors = doctors.filter(d =>
    d.workingHours.length === 0 || d.workingHours.some(wh => wh.dayOfWeek === dayOfWeek && wh.period != null)
  );

  // Sort: morning first, then full-day/scheduled, then afternoon
  const morningDoctors = filteredDoctors.filter(d => {
    const wh = d.workingHours.find(w => w.dayOfWeek === dayOfWeek && w.period != null);
    return !wh || wh.period === 'M' || wh.period === 'MT' || wh.period === 'AG';
  });
  const afternoonDoctors = filteredDoctors.filter(d => {
    const wh = d.workingHours.find(w => w.dayOfWeek === dayOfWeek && w.period != null);
    return wh?.period === 'T';
  });
  const availableDoctors = [...morningDoctors, ...afternoonDoctors];

  let lastScheduledIndex = -1;
  for (let i = 0; i < availableDoctors.length; i++) {
    const doctor = availableDoctors[i];
    const doctorSchedule = doctor.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);

    // Adjust currentTime forward if doctor's period starts later (e.g. afternoon doctors)
    if (doctorSchedule) {
      const doctorTimes = getWorkingHourTimes(doctorSchedule);
      const doctorStartTime = parseTime(doctorTimes.startTime);
      if (currentTime < doctorStartTime) {
        currentTime = doctorStartTime;
      }
      // Note: we do NOT skip based on doctorEndTime — period defines order, not a hard cutoff.
      // If the overall workday still has time, we schedule the doctor regardless of their period window.
    }

    // Stop only when the overall workday is over
    if (currentTime + visitDuration > endTime) {
      break;
    }

    // Calculate travel time from the last actually scheduled doctor
    let travelTime = 0;
    let distance = 0;
    if (lastScheduledIndex >= 0 && availableDoctors[lastScheduledIndex].coordinates && doctor.coordinates) {
      distance = haversineDistance(availableDoctors[lastScheduledIndex].coordinates!, doctor.coordinates);
      travelTime = estimateTravelTime(distance);
    }

    const scheduledTime = formatMinutesToTime(currentTime);
    const estimatedEndTime = formatMinutesToTime(currentTime + visitDuration);

    visits.push({
      id: `${date.toISOString()}-${doctor.id}`,
      dailyScheduleId: '',
      doctorId: doctor.id,
      doctor,
      order: visits.length + 1,
      scheduledTime,
      estimatedEndTime,
      estimatedTravelTime: travelTime,
      estimatedDistance: distance,
      status: 'pending'
    });

    lastScheduledIndex = i;
    // Move to next time slot
    currentTime += visitDuration + minimumInterval + travelTime;
  }

  return visits;
}

// Parse time string (HH:mm) to minutes since midnight
function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Format minutes since midnight to time string (HH:mm)
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Calculate total route statistics
export function calculateRouteStats(visits: ScheduledVisit[]): {
  totalDistance: number;
  totalTime: number;
  visitCount: number;
} {
  return {
    totalDistance: visits.reduce((sum, v) => sum + (v.estimatedDistance || 0), 0),
    totalTime: visits.reduce((sum, v) => sum + (v.estimatedTravelTime || 0), 0),
    visitCount: visits.length
  };
}

// Insert a new doctor into an existing schedule with optimal positioning
export function insertDoctorOptimized(
  existingDoctors: Doctor[],
  newDoctor: Doctor
): Doctor[] {
  if (existingDoctors.length === 0) {
    return [newDoctor];
  }

  // If the new doctor doesn't have coordinates, add at the end
  if (!newDoctor.coordinates) {
    return [...existingDoctors, newDoctor];
  }

  // Find the best position to insert the new doctor
  let bestPosition = existingDoctors.length;
  let bestTotalDistance = Infinity;

  // Try inserting at each position
  for (let i = 0; i <= existingDoctors.length; i++) {
    let totalDistance = 0;

    // Calculate distance with new doctor at position i
    const testOrder = [
      ...existingDoctors.slice(0, i),
      newDoctor,
      ...existingDoctors.slice(i)
    ];

    for (let j = 1; j < testOrder.length; j++) {
      const prev = testOrder[j - 1];
      const curr = testOrder[j];
      if (prev.coordinates && curr.coordinates) {
        totalDistance += haversineDistance(prev.coordinates, curr.coordinates);
      }
    }

    if (totalDistance < bestTotalDistance) {
      bestTotalDistance = totalDistance;
      bestPosition = i;
    }
  }

  // Insert at the best position
  return [
    ...existingDoctors.slice(0, bestPosition),
    newDoctor,
    ...existingDoctors.slice(bestPosition)
  ];
}

// Recalculate schedule times for a list of doctors
export function recalculateScheduleTimes(
  doctors: Doctor[],
  date: Date,
  visitDuration: number,
  workStartTime: string,
  workEndTime: string,
  minimumInterval: number
): ScheduledVisit[] {
  return generateScheduleFromDoctors(
    doctors,
    date,
    visitDuration,
    workStartTime,
    workEndTime,
    minimumInterval
  );
}

// Allocate pharmacies to days based on proximity to each day's doctor centroid
export function allocatePharmaciesPerDay(
  pharmacies: Pharmacy[],
  dayDoctors: { dateStr: string; doctors: Doctor[] }[],
  maxPerDay: number // 0 = unlimited
): Map<string, Pharmacy[]> {
  const result = new Map<string, Pharmacy[]>();
  for (const day of dayDoctors) result.set(day.dateStr, []);

  if (pharmacies.length === 0 || dayDoctors.length === 0) return result;

  // Compute centroid for each day from its doctors
  const dayCentroids: (Coordinates | null)[] = dayDoctors.map(day => {
    const withCoords = day.doctors.filter(d => d.coordinates);
    if (withCoords.length === 0) return null;
    return {
      latitude: withCoords.reduce((s, d) => s + d.coordinates!.latitude, 0) / withCoords.length,
      longitude: withCoords.reduce((s, d) => s + d.coordinates!.longitude, 0) / withCoords.length,
    };
  });

  const withCoords = pharmacies.filter(p => p.coordinates);
  const withoutCoords = pharmacies.filter(p => !p.coordinates);

  // Build all pharmacy-day distance pairs
  interface Pair { pi: number; di: number; distance: number }
  const pairs: Pair[] = [];
  for (let pi = 0; pi < withCoords.length; pi++) {
    for (let di = 0; di < dayDoctors.length; di++) {
      const centroid = dayCentroids[di];
      if (!centroid) continue;
      pairs.push({ pi, di, distance: haversineDistance(withCoords[pi].coordinates!, centroid) });
    }
  }
  pairs.sort((a, b) => a.distance - b.distance);

  // Greedily assign each pharmacy to its nearest day with capacity
  const assigned = new Set<number>();
  for (const { pi, di } of pairs) {
    if (assigned.has(pi)) continue;
    const dateStr = dayDoctors[di].dateStr;
    const list = result.get(dateStr)!;
    if (maxPerDay > 0 && list.length >= maxPerDay) continue;
    list.push(withCoords[pi]);
    assigned.add(pi);
  }

  // Pharmacies without coordinates: assign to day with fewest
  for (const pharmacy of withoutCoords) {
    let bestDate = dayDoctors[0].dateStr;
    let minCount = Infinity;
    for (const day of dayDoctors) {
      const count = result.get(day.dateStr)!.length;
      if (maxPerDay > 0 && count >= maxPerDay) continue;
      if (count < minCount) { minCount = count; bestDate = day.dateStr; }
    }
    result.get(bestDate)!.push(pharmacy);
  }

  return result;
}

// Generate pharmacy visits to append after doctor visits in a day schedule
export function generatePharmacyVisits(
  pharmacies: Pharmacy[],
  startAfterTime: string,
  startAfterCoords: Coordinates | undefined,
  visitDuration: number,
  workEndTime: string,
  minimumInterval: number,
  startOrder: number
): Omit<ScheduledVisit, 'id' | 'dailyScheduleId'>[] {
  if (pharmacies.length === 0) return [];

  // Sort by nearest neighbor from last doctor position
  const ordered = optimizePharmacyOrder(pharmacies, startAfterCoords);

  const visits: Omit<ScheduledVisit, 'id' | 'dailyScheduleId'>[] = [];
  let currentMinutes = parseTimeStr(startAfterTime);
  const endMinutes = parseTimeStr(workEndTime);
  let prevCoords = startAfterCoords;

  for (let i = 0; i < ordered.length; i++) {
    const pharmacy = ordered[i];
    if (currentMinutes + visitDuration > endMinutes) break;

    let travelTime = 0;
    let distance = 0;
    if (prevCoords && pharmacy.coordinates) {
      distance = haversineDistance(prevCoords, pharmacy.coordinates);
      travelTime = estimateTravelTime(distance);
    }

    currentMinutes += travelTime;
    if (currentMinutes + visitDuration > endMinutes) break;

    visits.push({
      doctorId: '',
      pharmacyId: pharmacy.id,
      pharmacy,
      order: startOrder + i,
      scheduledTime: minsToTimeStr(currentMinutes),
      estimatedEndTime: minsToTimeStr(currentMinutes + visitDuration),
      estimatedTravelTime: travelTime,
      estimatedDistance: distance,
      status: 'pending',
      isSuggestion: false,
    });

    currentMinutes += visitDuration + minimumInterval;
    prevCoords = pharmacy.coordinates;
  }

  return visits;
}

function optimizePharmacyOrder(pharmacies: Pharmacy[], startPoint?: Coordinates): Pharmacy[] {
  if (pharmacies.length <= 1) return pharmacies;
  const withCoords = pharmacies.filter(p => p.coordinates);
  const withoutCoords = pharmacies.filter(p => !p.coordinates);
  if (withCoords.length === 0) return pharmacies;

  const visited = new Set<string>();
  const result: Pharmacy[] = [];
  let current: Coordinates = startPoint || withCoords[0].coordinates!;

  if (!startPoint) {
    result.push(withCoords[0]);
    visited.add(withCoords[0].id);
  }

  while (result.length < withCoords.length) {
    let nearest: Pharmacy | null = null;
    let nearestDist = Infinity;
    for (const p of withCoords) {
      if (visited.has(p.id) || !p.coordinates) continue;
      const d = haversineDistance(current, p.coordinates);
      if (d < nearestDist) { nearestDist = d; nearest = p; }
    }
    if (nearest) {
      result.push(nearest);
      visited.add(nearest.id);
      current = nearest.coordinates!;
    }
  }

  return [...result, ...withoutCoords];
}

function parseTimeStr(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minsToTimeStr(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Generate Google Maps navigation URL
export function getGoogleMapsUrl(destination: Coordinates): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`;
}

// Generate Waze navigation URL
export function getWazeUrl(destination: Coordinates): string {
  return `https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`;
}
