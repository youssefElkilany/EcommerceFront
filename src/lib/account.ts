export const egyptGovernorates = ['Alexandria', 'Aswan', 'Asyut', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Faiyum', 'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matrouh', 'Minya', 'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez'];
export type Account = { id: string; name: string; email: string; phone: string; role: string; emailVerified: boolean; joinedAt?: string };
export type Address = { _id: string; label: 'home' | 'work' | 'other'; name: string; phone: string; country: string; governorate?: string; city: string; street: string; buildingNumber?: string; district?: string; apartmentNumber?: string; floor?: string; landmark?: string; deliveryInstructions?: string; isDefault: boolean };
export async function accountRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Unable to complete your request.'), { status: response.status });
  return data as T;
}
