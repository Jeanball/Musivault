// Condition grades for media
export const MEDIA_CONDITIONS = [
    { value: 'M', labelKey: 'condition.grades.mint' },
    { value: 'NM', labelKey: 'condition.grades.nearMint' },
    { value: 'VG+', labelKey: 'condition.grades.veryGoodPlus' },
    { value: 'VG', labelKey: 'condition.grades.veryGood' },
    { value: 'G+', labelKey: 'condition.grades.goodPlus' },
    { value: 'G', labelKey: 'condition.grades.good' },
    { value: 'F', labelKey: 'condition.grades.fair' },
    { value: 'P', labelKey: 'condition.grades.poor' },
];

// Condition grades for sleeve (includes additional options)
export const SLEEVE_CONDITIONS = [
    ...MEDIA_CONDITIONS,
    { value: 'Not Graded', labelKey: 'condition.grades.notGraded' },
    { value: 'Generic', labelKey: 'condition.grades.generic' },
    { value: 'No Cover', labelKey: 'condition.grades.noCover' },
];
