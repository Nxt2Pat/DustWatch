import { useEffect } from 'react';

export function useSEO(title: string, description?: string) {
  useEffect(() => {
    // 1. Update tab title
    document.title = title;

    // 2. Manage meta description tag
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', description);
    }
  }, [title, description]);
}
