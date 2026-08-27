import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { categorySchema, complianceSchema, funnelSchema, marketingSchema, mediaSchema, productSchema, seoSchema, socialProfileSchema, type Category, type Compliance, type Funnel, type Marketing, type Media, type Product, type Seo } from '../../schemas/manifests';

const root = process.cwd();
const read = (file: string) => YAML.parse(fs.readFileSync(file, 'utf8'));
const yamlFiles = (dir: string) => fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter(x => /\.ya?ml$/.test(String(x))).map(x => path.join(dir, String(x))) : [];

export type ProductRecord = { product: Product; funnel: Funnel; compliance: Compliance; media: Media; seo: Seo; directory: string };
export function loadProducts(): ProductRecord[] {
  const base = path.join(root, 'src/content/products');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true }).filter(x => x.isDirectory()).map(entry => {
    const directory = path.join(base, entry.name);
    return { directory, product: productSchema.parse(read(path.join(directory, 'product.yaml'))), funnel: funnelSchema.parse(read(path.join(directory, 'funnel.yaml'))), compliance: complianceSchema.parse(read(path.join(directory, 'compliance.yaml'))), media: mediaSchema.parse(read(path.join(directory, 'media.yaml'))), seo: seoSchema.parse(read(path.join(directory, 'seo.yaml'))) };
  });
}
export const loadCategories = (): Category[] => yamlFiles(path.join(root, 'src/content/categories')).map(x => categorySchema.parse(read(x)));
export const loadMarketing = (): Marketing[] => yamlFiles(path.join(root, 'src/content/products')).filter(x => x.includes(`${path.sep}marketing${path.sep}`)).map(x => marketingSchema.parse(read(x)));
export const loadProfiles = () => yamlFiles(path.join(root, 'src/content/social-profiles')).map(x => socialProfileSchema.parse(read(x)));
