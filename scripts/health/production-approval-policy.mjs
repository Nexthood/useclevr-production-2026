export const productionEnvironment = "useclevr-web / production";

/** Read metadata only. Missing/inaccessible protection fails closed before publication. */
export async function verifyProductionApproval(github, repository) {
  const { data: environment } = await github.rest.repos.getEnvironment({
    ...repository,
    environment_name: productionEnvironment,
  });
  const reviewerRules = environment.protection_rules?.filter(
    (item) => item.type === "required_reviewers",
  );
  const rule = reviewerRules?.length === 1 ? reviewerRules[0] : undefined;
  const reviewers = rule?.reviewers;
  if (
    environment.name !== productionEnvironment ||
    environment.can_admins_bypass !== false ||
    rule?.prevent_self_review !== false ||
    reviewers?.length !== 1 ||
    reviewers[0].type !== "User" ||
    reviewers[0].reviewer?.type !== "User" ||
    reviewers[0].reviewer?.login !== "Nexthood" ||
    environment.deployment_branch_policy?.protected_branches !== false ||
    environment.deployment_branch_policy?.custom_branch_policies !== true
  ) {
    throw new Error(
      "Production publication is blocked: require Nexthood as the sole user reviewer, allow self-review, disable admin bypass, and restrict deployment to main.",
    );
  }
  const { data: policies } = await github.rest.repos.listDeploymentBranchPolicies({
    ...repository,
    environment_name: productionEnvironment,
    per_page: 100,
  });
  if (
    policies.total_count !== 1 ||
    policies.branch_policies?.length !== 1 ||
    policies.branch_policies[0].name !== "main" ||
    policies.branch_policies[0].type !== "branch"
  ) {
    throw new Error(
      "Production publication is blocked: the environment must allow only the main branch.",
    );
  }
}
