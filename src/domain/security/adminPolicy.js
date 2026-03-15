export const isAdminByLabels = (labels, allowedAdminLabelsLower) => {
  const list = Array.isArray(labels) ? labels : [];
  const lower = list.map((l) => String(l).toLowerCase());
  return lower.some((l) => allowedAdminLabelsLower.includes(l));
};

