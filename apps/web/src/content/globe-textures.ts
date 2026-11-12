/**
 * Texturas do globo 3D da landing. Imagens de satélite da NASA, em domínio público, obtidas no Wikimedia Commons.
 * Domínio público não exige atribuição, mas mostramos a fonte na página /creditos.
 */
export const GLOBE_TEXTURES = [
  {
    key: 'terra-dia',
    src: '/images/globe/terra-dia.jpg',
    title: 'Terra de dia (Blue Marble)',
    author: 'NASA Earth Observatory / NASA Goddard Space Flight Center',
    license: 'Domínio público',
    source: 'https://commons.wikimedia.org/wiki/File:Whole_world_-_land_and_oceans.jpg',
  },
  {
    key: 'terra-noite',
    src: '/images/globe/terra-noite.jpg',
    title: 'Terra à noite (Black Marble)',
    author: 'NASA Earth Observatory',
    license: 'Domínio público',
    source: 'https://commons.wikimedia.org/wiki/File:The_earth_at_night.jpg',
  },
] as const;
