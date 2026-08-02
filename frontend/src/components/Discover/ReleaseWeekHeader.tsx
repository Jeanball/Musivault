import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import type { ReleaseWeekGroup } from '../../api/discover';
import { formatMonthYear, formatShortDate, weeksFromCurrentWeek } from '../../utils/date';

interface ReleaseWeekHeaderProps {
    group: ReleaseWeekGroup;
}

const ReleaseWeekHeader: React.FC<ReleaseWeekHeaderProps> = ({ group }) => {
    const { t, i18n } = useTranslation();

    let label: string;
    if (group.kind === 'month') {
        label = t('discover.duringMonth', { month: formatMonthYear(group.month!, i18n.language) });
    } else {
        const offset = weeksFromCurrentWeek(group.weekStart!);
        if (offset === 0) label = t('discover.thisWeek');
        else if (offset === 1) label = t('discover.nextWeek');
        else if (offset === -1) label = t('discover.lastWeek');
        else label = t('discover.weekOf', { date: formatShortDate(group.weekStart!, i18n.language) });
    }

    return (
        <h3 className="text-sm font-semibold mb-3 text-base-content/70 flex items-center gap-2">
            <CalendarDays size={16} />
            {label}
            <span className="badge badge-sm badge-neutral">{group.releases.length}</span>
        </h3>
    );
};

export default ReleaseWeekHeader;
