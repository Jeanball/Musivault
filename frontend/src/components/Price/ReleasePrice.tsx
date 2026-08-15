import { useTranslation } from 'react-i18next';
import { DEFAULT_PRICE_CONDITION } from '../../utils/conditions';
import { getPriceForCondition } from '../../utils/itemValue';
import { useCurrency } from '../../hooks/useCurrency';
import type { ConditionPrices } from '../../types/collection.types';

interface ReleasePriceProps {
    price: ConditionPrices | null;
    isLoading: boolean;
    /** Grade to price. Defaults to VG+, the grade the collection values on. */
    condition?: string | null;
}

/**
 * Rough market value of a release for one condition grade. Deliberately quiet:
 * it informs the choice without competing with it. Purely presentational, the
 * release is priced once by the page and the result is shared by the modals.
 */
function ReleasePrice({ price, isLoading, condition }: ReleasePriceProps) {
    const { t } = useTranslation();
    const { formatValue } = useCurrency();

    if (isLoading) {
        return (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-base-content/50">
                <span className="loading loading-spinner loading-xs" />
                {t('price.loading')}
            </p>
        );
    }

    if (!price) return null;

    const amount = getPriceForCondition(price, condition);
    if (amount <= 0) return null;

    return (
        <div className="mt-2 text-center text-xs text-base-content/50">
            <p>{t('price.estimatedValue')}</p>
            <p className="text-sm font-semibold text-base-content/80">
                {formatValue(amount, price.currency)}
            </p>
            <p>{t('price.basedOn', { condition: condition || DEFAULT_PRICE_CONDITION })}</p>
        </div>
    );
}

export default ReleasePrice;
