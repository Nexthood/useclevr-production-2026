export class PartnerRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartnerRuleError";
  }
}
