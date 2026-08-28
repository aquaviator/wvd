import type { Product } from '../../schemas/manifests';

export const isPubliclyIndexable = (product: Pick<Product, 'status'>) => product.status === 'active';
