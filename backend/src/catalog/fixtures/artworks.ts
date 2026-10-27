// Cleveland API contract fixtures; IDs 900000001/2 are synthetic test cases.
export const artworkResponses = [
  {
    data: {
      id: 141639,
      title: 'Twilight in the Wilderness',
      creators: [
        {
          id: 2697,
          description: 'Frederic Edwin Church (American, 1826\u20131900)',
          extent: null,
          qualifier: null,
          role: 'artist',
          biography: null,
          name_in_original_language: null,
          birth_year: '1826',
          death_year: '1900',
          use_in_caption: true,
          include_extent: false,
          weight: 1,
        },
      ],
      images: {
        annotation: '',
        web: {
          url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_web.jpg',
          width: '900',
          height: '562',
          filesize: '254485',
          filename: '1965.233_web.jpg',
        },
        print: {
          url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_print.jpg',
          width: '3400',
          height: '2123',
          filesize: '1604230',
          filename: '1965.233_print.jpg',
        },
        full: {
          url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_full.tif',
          width: '7673',
          height: '4791',
          filesize: '110309980',
          filename: '1965.233_full.tif',
        },
      },
      creditline: 'Mr. and Mrs. William H. Marlatt Fund',
      share_license_status: 'CC0',
      creation_date: '1860',
      technique: 'oil on canvas',
      measurements:
        'Unframed: 101.6 x 162.6 cm (40 x 64 in.); Framed: 124 x 185 x 13 cm (48 13/16 x 72 13/16 x 5 1/8 in.)',
      type: 'Painting',
    },
  },
  {
    data: {
      id: 900000001,
      title: 'Test landscape',
      creators: [],
      images: {
        annotation: '',
        web: {
          url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_web.jpg',
          width: '900',
          height: '562',
          filesize: '254485',
          filename: '1965.233_web.jpg',
        },
        print: {
          url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_print.jpg',
          width: '3400',
          height: '2123',
          filesize: '1604230',
          filename: '1965.233_print.jpg',
        },
        full: {
          url: 'https://openaccess-cdn.clevelandart.org/1965.233/1965.233_full.tif',
          width: '7673',
          height: '4791',
          filesize: '110309980',
          filename: '1965.233_full.tif',
        },
      },
      creditline: 'Mr. and Mrs. William H. Marlatt Fund',
      share_license_status: 'CC0',
      creation_date: '1860',
      technique: 'oil on canvas',
      measurements:
        'Unframed: 101.6 x 162.6 cm (40 x 64 in.); Framed: 124 x 185 x 13 cm (48 13/16 x 72 13/16 x 5 1/8 in.)',
      type: 'Painting',
    },
  },
  {
    data: {
      id: 900000002,
      title: 'Test restricted painting',
      creators: [],
      images: null,
      creditline: 'Mr. and Mrs. William H. Marlatt Fund',
      share_license_status: 'Copyrighted',
      creation_date: '1860',
      technique: 'oil on canvas',
      measurements: null,
      type: 'Painting',
    },
  },
];
