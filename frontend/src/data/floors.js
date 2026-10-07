/** Floor labels from Light Exchange building sectional diagram */
export const FLOORS = [
  {
    id: 'l30-31',
    label: 'L30–L31',
    description: 'Hotel pool, gym, spa, bar',
    zoneId: 'zone-e',
    color: '#fb7185',
  },
  {
    id: 'l29',
    label: 'L29',
    description: 'Executive lounge & restaurant',
    zoneId: 'zone-e',
    color: '#f43f5e',
  },
  {
    id: 'l14-28',
    label: 'L14–L28',
    description: 'Hotel typical – 459 keys',
    zoneId: 'zone-d',
    color: '#e11d48',
  },
  {
    id: 'l13',
    label: 'L13',
    description: 'M&E transfer floor',
    zoneId: 'zone-c',
    color: '#64748b',
  },
  {
    id: 'l4-12',
    label: 'L4–L12',
    description: 'Office : 9 floors',
    zoneId: 'zone-c',
    color: '#3b82f6',
  },
  {
    id: 'l3',
    label: 'L3',
    description: 'Chinese restaurant',
    zoneId: 'zone-b',
    color: '#d97706',
  },
  {
    id: 'l2',
    label: 'L2',
    description: 'Ballroom, meeting room',
    zoneId: 'zone-b',
    color: '#0d9488',
  },
  {
    id: 'l1',
    label: 'L1',
    description: 'All-day dining, link to retail',
    zoneId: 'zone-b',
    color: '#14b8a6',
  },
  {
    id: 'gf',
    label: 'GF',
    description: 'Office / hotel lobby',
    zoneId: 'zone-b',
    color: '#e11d48',
  },
  {
    id: 'lg-lm',
    label: 'LG & LM',
    description: 'M&E, valet parking & hotel BOH',
    zoneId: 'zone-a',
    color: '#a8a29e',
  },
  {
    id: 'b1-b2',
    label: 'B1 & B2',
    description: 'Carpark',
    zoneId: 'zone-a',
    color: '#64748b',
  },
];

export function getFloorById(id) {
  return FLOORS.find((f) => f.id === id) || null;
}
