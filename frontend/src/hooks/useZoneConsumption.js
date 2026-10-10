import useSWR from 'swr';

export const EMS_API = 'http://localhost:5000';

const fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`EMS API ${response.status}`);
  }
  return response.json();
};

export function useZoneConsumption() {
  return useSWR(`${EMS_API}/api/v1/zones/consumption`, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });
}

export async function downloadGreenReEvidence() {
  const response = await fetch(`${EMS_API}/api/v1/reports/greenre`);
  if (!response.ok) {
    throw new Error(`Report generation failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'greenre-evidence.pdf';
  anchor.click();
  URL.revokeObjectURL(url);
}
