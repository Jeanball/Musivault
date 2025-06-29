import { useState, useEffect } from 'react';

/**
 * Hook personnalisé pour "débattre" une valeur.
 * Il ne met à jour la valeur retournée que si aucun nouveau changement n'est survenu
 * pendant le délai spécifié (delay).
 * @param value La valeur à débattre (ex: le texte de la recherche)
 * @param delay Le délai en millisecondes (ex: 500)
 * @returns La valeur débattue.
 */
export function useDebounce<T>(value: T, delay: number): T {
  // État interne pour stocker la valeur débattue
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // On met en place un minuteur pour mettre à jour la valeur après le délai
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Fonction de nettoyage : si la valeur change (l'utilisateur tape à nouveau),
    // on annule le minuteur précédent pour en créer un nouveau.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // L'effet se redéclenche uniquement si la valeur ou le délai change

  return debouncedValue;
}
