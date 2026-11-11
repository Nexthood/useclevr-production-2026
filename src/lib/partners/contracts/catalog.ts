import sales from "./templates/independent_sales.v1.json";
import reseller from "./templates/authorized_reseller.v1.json";
import { hashObject, type Template } from "./domain";
export const templates = [sales, reseller] as Template[];
export const templateChecksum = (template: Template) =>
  hashObject({
    id: template.id,
    agreementType: template.agreementType,
    version: template.version,
    title: template.title,
    body: template.body,
  });
