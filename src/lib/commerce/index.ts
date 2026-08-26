import type { Funnel } from '../../schemas/manifests';
export interface CommerceProvider { getCheckoutDestination(): string | null; isAvailable(): boolean; }
export const getCommerceProvider = (funnel: Funnel): CommerceProvider => ({ getCheckoutDestination: () => funnel.checkout.provider_url_or_id, isAvailable: () => Boolean(funnel.checkout.provider_url_or_id) });
