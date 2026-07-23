import type { ICity, IState } from "@countrystatecity/countries";

export type { ICity, IState };

export async function fetchStates(countryCode: string): Promise<IState[]> {
  const { getStatesOfCountry } = await import("@countrystatecity/countries");
  const states = await getStatesOfCountry(countryCode.toUpperCase());
  return [...states].sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchCities(
  countryCode: string,
  stateIso2: string,
): Promise<ICity[]> {
  const { getCitiesOfState } = await import("@countrystatecity/countries");
  const cities = await getCitiesOfState(countryCode.toUpperCase(), stateIso2);
  return [...cities].sort((a, b) => a.name.localeCompare(b.name));
}

export function findStateByName(states: IState[], name: string): IState | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return states.find((s) => s.name.toLowerCase() === n);
}
