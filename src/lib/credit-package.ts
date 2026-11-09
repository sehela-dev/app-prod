type InstructorRestriction = { id?: string; name?: string | null };

export const formatEligibleTime = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  return `${start.slice(0, 5)}–${end.slice(0, 5)} WIB`;
};

export const formatInstructorNames = (instructors?: InstructorRestriction[] | null) =>
  instructors?.length
    ? instructors.map((instructor) => instructor.name || instructor.id || "Unknown instructor").join(", ")
    : null;

export const formatPackageEligibility = (pkg: {
  instructor_ids_restriction?: InstructorRestriction[] | null;
  eligible_start_time?: string | null;
  eligible_end_time?: string | null;
}) => {
  const instructors = formatInstructorNames(pkg.instructor_ids_restriction);
  const time = formatEligibleTime(pkg.eligible_start_time, pkg.eligible_end_time);
  if (instructors && time) return `Hanya dengan ${instructors} · sesi ${time}`;
  if (instructors) return `Hanya dengan: ${instructors}`;
  if (time) return `Hanya sesi ${time}`;
  return "Semua instructor · Semua jam";
};
