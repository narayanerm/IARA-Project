// Notable places of the Yanomami Indigenous Territory, shared by the map points and the scroll tour.
// Every figure and fact carries its source; positions marked approx are explained in approxNote.
// Images are linked from Wikimedia Commons under their free licences (see YANOMAMI_CREDITS).

export type Bilingual = { pt: string; en: string }
export type SourceLink = { label: string; url: string }
export type PlaceImage = { src: string; page: string; author: string; license: string; desc: string; alt: Bilingual }
export type PlaceStat = { label: Bilingual; value: string; sources: SourceLink[] }
export type PlaceEvent = { year: string; text: Bilingual; sources: SourceLink[] }
export type ExploreLink = { kind: 'earth' | 'streetview' | 'streetview-nearby'; label: Bilingual; url: string }

export interface YanomamiPlace {
  id: string
  name: Bilingual
  river: Bilingual
  lat: number
  lon: number
  /** True when the exact site is not public; see approxNote. */
  approx: boolean
  approxNote?: Bilingual
  coordSources: SourceLink[]
  summary: Bilingual
  images: PlaceImage[]
  stats: PlaceStat[]
  events: PlaceEvent[]
  explore: ExploreLink[]
}

/** Street View reality check: Google has no street-level coverage inside the territory, so each place links a
 *  Google Earth 3D view and, clearly labelled, the nearest city with Street View (Boa Vista). */
export const STREET_VIEW_NOTE: Bilingual = {
  pt: 'O Google Street View não cobre o interior da Terra Indígena Yanomami. Os links abrem a vista 3D do Google Earth no ponto e, separado, o Street View mais próximo, em Boa Vista.',
  en: 'Google Street View does not cover the interior of the Yanomami Indigenous Territory. The links open a Google Earth 3D view of the spot and, separately, the nearest Street View, in Boa Vista.',
}

export const YANOMAMI_PLACES: YanomamiPlace[] = [
  {
    "id": "surucucu",
    "name": {
      "pt": "Surucucu",
      "en": "Surucucu"
    },
    "river": {
      "pt": "Serra das Surucucus, alto Parima",
      "en": "Surucucus highlands, upper Parima"
    },
    "lat": 2.83528,
    "lon": -63.64694,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q16141983 · Aeroporto Surucucu (SWUQ)",
        "url": "https://www.wikidata.org/wiki/Q16141983"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Pista de pouso registrada (SWUQ) no planalto das Surucucus, em Alto Alegre (RR), no coração da terra Yanomami.",
      "en": "Registered airstrip (SWUQ) on the Surucucus plateau, in Alto Alegre (Roraima), at the heart of Yanomami land."
    },
    "images": [
      {
        "src": "https://upload.wikimedia.org/wikipedia/commons/4/45/Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel%2C_Roraima%2C_por_militares_das_For%C3%A7as_Armadas_-_2023_%2853185282296%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel,_Roraima,_por_militares_das_For%C3%A7as_Armadas_-_2023_(53185282296).jpg",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "Neutralização da pista de pouso que sustentava o garimpo ilegal em Rangel, na Terra Indígena Yanomami, Roraima, por militares das Forças Armadas - 2023",
        "alt": {
          "pt": "Militares inutilizam uma pista de pouso clandestina de garimpo em Rangel, Terra Indígena Yanomami, 2023.",
          "en": "Soldiers disable a clandestine mining airstrip at Rangel, Yanomami Indigenous Territory, 2023."
        }
      },
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Opera%C3%A7%C3%A3o_Catrimani_-_2024_%2853817244491%29.png/960px-Opera%C3%A7%C3%A3o_Catrimani_-_2024_%2853817244491%29.png",
        "page": "https://commons.wikimedia.org/wiki/File:Opera%C3%A7%C3%A3o_Catrimani_-_2024_(53817244491).png",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "A Marinha do Brasil passou a comandar o Estado-Maior Conjunto da Operação “Catrimani II” que, desde 1º de abril, combate o garimpo ilegal na Terra Indígena Yano",
        "alt": {
          "pt": "Operação Catrimani II contra o garimpo ilegal, 2024.",
          "en": "Operation Catrimani II against illegal mining, 2024."
        }
      }
    ],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@2.83528,-63.64694,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "palimiu",
    "name": {
      "pt": "Palimiú",
      "en": "Palimiú"
    },
    "river": {
      "pt": "Rio Uraricoera",
      "en": "Uraricoera river"
    },
    "lat": 3.31806,
    "lon": -62.97111,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q31205719 · Aeródromo Palimiú (SJMH)",
        "url": "https://www.wikidata.org/wiki/Q31205719"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Comunidade às margens do Uraricoera, principal corredor de barcos do garimpo. Em maio de 2021 foi atacada a tiros por garimpeiros depois de montar uma barreira sanitária no rio.",
      "en": "Community on the Uraricoera, the main boat corridor for mining. In May 2021 it was shot at by miners after setting up a health checkpoint on the river."
    },
    "images": [
      {
        "src": "https://upload.wikimedia.org/wikipedia/commons/e/e0/Gar%C3%A7a_de_eleg%C3%A2ncia.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Gar%C3%A7a_de_eleg%C3%A2ncia.jpg",
        "author": "Suzana Lemos",
        "license": "CC BY-SA 4.0",
        "desc": "Registrada nas proximidades do Rio Uraricoera, Estado de Roraima, esta ave, típica dessa região, surgiu sem muita preocupação com seus predadores.",
        "alt": {
          "pt": "Garça às margens do rio Uraricoera, Roraima.",
          "en": "A heron on the banks of the Uraricoera river, Roraima."
        }
      },
      {
        "src": "https://upload.wikimedia.org/wikipedia/commons/4/45/Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel%2C_Roraima%2C_por_militares_das_For%C3%A7as_Armadas_-_2023_%2853185282296%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel,_Roraima,_por_militares_das_For%C3%A7as_Armadas_-_2023_(53185282296).jpg",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "Neutralização da pista de pouso que sustentava o garimpo ilegal em Rangel, na Terra Indígena Yanomami, Roraima, por militares das Forças Armadas - 2023",
        "alt": {
          "pt": "Militares inutilizam uma pista de pouso clandestina de garimpo em Rangel, Terra Indígena Yanomami, 2023.",
          "en": "Soldiers disable a clandestine mining airstrip at Rangel, Yanomami Indigenous Territory, 2023."
        }
      }
    ],
    "stats": [],
    "events": [
      {
        "year": "2021",
        "text": {
          "pt": "10 de maio: sete barcos de garimpeiros atracam e atacam a comunidade a tiros; novos ataques seguem nas semanas seguintes. A Hutukara envia ofícios pedindo proteção.",
          "en": "May 10: seven miners' boats dock and shoot at the community; new attacks follow in the weeks after. Hutukara sends letters asking for protection."
        },
        "sources": [
          {
            "label": "Hutukara Associação Yanomami · ofício de 17/05/2021 (ISA)",
            "url": "https://site-antigo.socioambiental.org/sites/blog.socioambiental.org/files/nsa/arquivos/oficio_hay_-_novo_conflito_no_palimiu_17-05-2021.pdf"
          },
          {
            "label": "Correio Braziliense, 05/2021",
            "url": "https://www.correiobraziliense.com.br/brasil/2021/05/4925565-comunidade-yanomami-e-alvo-de-garimpeiros-fortemente-armados.html"
          }
        ]
      }
    ],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@3.31806,-62.97111,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "homoxi",
    "name": {
      "pt": "Homoxi",
      "en": "Homoxi"
    },
    "river": {
      "pt": "Alto rio Mucajaí",
      "en": "Upper Mucajaí river"
    },
    "lat": 2.49778,
    "lon": -63.72972,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q31205526 · Aeródromo Homoxi (SJLF)",
        "url": "https://www.wikidata.org/wiki/Q31205526"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Região do alto Mucajaí, perto da fronteira com a Venezuela, onde o garimpo abriu frentes de lavra ao longo do rio.",
      "en": "Upper Mucajaí area near the Venezuelan border, where mining opened pits along the river."
    },
    "images": [
      {
        "src": "https://upload.wikimedia.org/wikipedia/commons/4/45/Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel%2C_Roraima%2C_por_militares_das_For%C3%A7as_Armadas_-_2023_%2853185282296%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel,_Roraima,_por_militares_das_For%C3%A7as_Armadas_-_2023_(53185282296).jpg",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "Neutralização da pista de pouso que sustentava o garimpo ilegal em Rangel, na Terra Indígena Yanomami, Roraima, por militares das Forças Armadas - 2023",
        "alt": {
          "pt": "Militares inutilizam uma pista de pouso clandestina de garimpo em Rangel, Terra Indígena Yanomami, 2023.",
          "en": "Soldiers disable a clandestine mining airstrip at Rangel, Yanomami Indigenous Territory, 2023."
        }
      }
    ],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@2.49778,-63.72972,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "auaris",
    "name": {
      "pt": "Auaris",
      "en": "Auaris"
    },
    "river": {
      "pt": "Rio Auaris, extremo noroeste",
      "en": "Auaris river, far north-west"
    },
    "lat": 4.01639,
    "lon": -64.51861,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q9585447 · Aeroporto Auaris (SWBV)",
        "url": "https://www.wikidata.org/wiki/Q9585447"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Pista de pouso (SWBV) no extremo noroeste da terra, junto à fronteira com a Venezuela; região onde vivem Yanomami (Sanöma) e Ye'kwana.",
      "en": "Airstrip (SWBV) at the far north-west of the land, by the Venezuelan border; an area where Yanomami (Sanöma) and Ye'kwana live."
    },
    "images": [
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/Opera%C3%A7%C3%A3o_%C3%81gata_Fronteira_Norte_-_2023_%2853120754375%29.jpg/960px-Opera%C3%A7%C3%A3o_%C3%81gata_Fronteira_Norte_-_2023_%2853120754375%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Opera%C3%A7%C3%A3o_%C3%81gata_Fronteira_Norte_-_2023_(53120754375).jpg",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "Líder indígena Júlio Ye’kwana, da Associação Wanasseduume Ye’kwana, debateu a situação na Terra Indígena Yanomami (TIY) com representantes do Centro de Operaçõe",
        "alt": {
          "pt": "Júlio Ye'kwana, da Associação Wanasseduume Ye'kwana, em reunião da Operação Ágata, 2023.",
          "en": "Júlio Ye'kwana, of the Wanasseduume Ye'kwana Association, at an Operation Ágata meeting, 2023."
        }
      }
    ],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@4.01639,-64.51861,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "watoriki",
    "name": {
      "pt": "Watoriki (Demini)",
      "en": "Watoriki (Demini)"
    },
    "river": {
      "pt": "Rio Demini, Barcelos (AM)",
      "en": "Demini river, Barcelos (Amazonas)"
    },
    "lat": 1.71,
    "lon": -62.88,
    "approx": true,
    "approxNote": {
      "pt": "Posição aproximada: perto do marco norte da antiga Área Indígena Demini, na Perimetral Norte, onde ficam o posto Demini da Funai e a aldeia Watoriki. A coordenada exata da aldeia não é pública.",
      "en": "Approximate position: near the northern marker of the former Demini Indigenous Area, on the Perimetral Norte road, where the Funai Demini post and Watoriki village are. The village's exact coordinate is not public."
    },
    "coordSources": [
      {
        "label": "ISA · limites da Área Indígena Demini (Perimetral Norte)",
        "url": "https://acervo.socioambiental.org/sites/default/files/documents/YAD00244.pdf"
      },
      {
        "label": "Wikipedia · Davi Kopenawa",
        "url": "https://pt.wikipedia.org/wiki/Davi_Kopenawa"
      }
    ],
    "summary": {
      "pt": "Aldeia de Davi Kopenawa, xamã e presidente da Hutukara. Ele se mudou para Watoriki, ao lado do posto Demini da Funai, e liderou a campanha que levou à demarcação de 1992.",
      "en": "Home village of Davi Kopenawa, shaman and president of Hutukara. He moved to Watoriki, next to the Funai Demini post, and led the campaign that won the 1992 demarcation."
    },
    "images": [
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Davikopenawa.jpg/960px-Davikopenawa.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Davikopenawa.jpg",
        "author": "Fernando Frazão/Agência Brasil",
        "license": "CC BY 3.0 br",
        "desc": "Davi Kopenawa at 2014 International Literary Festival of Paraty. Photo by Fernando Frazão/Agência Brasil CCBY3.0.",
        "alt": {
          "pt": "Davi Kopenawa Yanomami na FLIP, Paraty, 2014.",
          "en": "Davi Kopenawa Yanomami at the Paraty literary festival, 2014."
        }
      },
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/Claudia_Andujar_e_Davi_Kopenawa.jpg/960px-Claudia_Andujar_e_Davi_Kopenawa.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Claudia_Andujar_e_Davi_Kopenawa.jpg",
        "author": "Fernando Frazão",
        "license": "CC BY 3.0 br",
        "desc": "A fotógrafa suíça Claudia Andujar e o xamã indígena Davi Kopenawa, pajé e presidente da Hutukara Associação Yanomami, participam de mesa que a Flip dedicada aos",
        "alt": {
          "pt": "A fotógrafa Claudia Andujar e Davi Kopenawa.",
          "en": "Photographer Claudia Andujar and Davi Kopenawa."
        }
      }
    ],
    "stats": [],
    "events": [
      {
        "year": "1992",
        "text": {
          "pt": "Davi Kopenawa é um dos principais responsáveis pela demarcação; cerca de 40 mil garimpeiros são retirados.",
          "en": "Davi Kopenawa is one of the main forces behind the demarcation; about 40,000 miners are removed."
        },
        "sources": [
          {
            "label": "Wikipedia · Davi Kopenawa",
            "url": "https://pt.wikipedia.org/wiki/Davi_Kopenawa"
          }
        ]
      }
    ],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@1.71,-62.88,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "haximu",
    "name": {
      "pt": "Haximu",
      "en": "Haximu"
    },
    "river": {
      "pt": "Alto Orinoco, fronteira com a Venezuela",
      "en": "Upper Orinoco, Venezuelan border"
    },
    "lat": 2.42,
    "lon": -63.85,
    "approx": true,
    "approxNote": {
      "pt": "Posição aproximada: a aldeia ficava no alto Orinoco, junto à fronteira, a oeste de Homoxi. O local exato não é público.",
      "en": "Approximate position: the village lay on the upper Orinoco, by the border, west of Homoxi. The exact site is not public."
    },
    "coordSources": [
      {
        "label": "Bruce Albert (1993), O massacre dos Yanomami de Haximu · ISA",
        "url": "https://pib.socioambiental.org/files/file/bac/yanomami/o_massacre_dos_yanomami_de_raximu.pdf"
      },
      {
        "label": "Wikipedia · Haximu massacre",
        "url": "https://en.wikipedia.org/wiki/Haximu_massacre"
      }
    ],
    "summary": {
      "pt": "Em 1993, garimpeiros mataram 16 Yanomami do grupo Haximu-teri, a maioria idosos, jovens e crianças, e queimaram a aldeia. A Justiça brasileira classificou o crime como genocídio.",
      "en": "In 1993 gold miners killed 16 Haximu-teri Yanomami, mostly elders, youths and children, and burned the village. Brazilian courts ruled the crime a genocide."
    },
    "images": [],
    "stats": [
      {
        "label": {
          "pt": "Mortos no massacre",
          "en": "Killed in the massacre"
        },
        "value": "16",
        "sources": [
          {
            "label": "Wikipedia · Haximu massacre",
            "url": "https://en.wikipedia.org/wiki/Haximu_massacre"
          }
        ]
      }
    ],
    "events": [
      {
        "year": "1993",
        "text": {
          "pt": "Massacre de Haximu: 16 Yanomami mortos por garimpeiros.",
          "en": "Haximu massacre: 16 Yanomami killed by gold miners."
        },
        "sources": [
          {
            "label": "Wikipedia · Haximu massacre",
            "url": "https://en.wikipedia.org/wiki/Haximu_massacre"
          },
          {
            "label": "Bruce Albert (1993), O massacre dos Yanomami de Haximu · ISA",
            "url": "https://pib.socioambiental.org/files/file/bac/yanomami/o_massacre_dos_yanomami_de_raximu.pdf"
          }
        ]
      },
      {
        "year": "1997",
        "text": {
          "pt": "Cinco garimpeiros são condenados por genocídio.",
          "en": "Five miners are convicted of genocide."
        },
        "sources": [
          {
            "label": "Wikipedia · Massacre de Haximu",
            "url": "https://pt.wikipedia.org/wiki/Massacre_de_Haximu"
          }
        ]
      }
    ],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@2.42,-63.85,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "aracaca",
    "name": {
      "pt": "Aracaçá",
      "en": "Aracaçá"
    },
    "river": {
      "pt": "Rio Uraricoera, região de Waikás",
      "en": "Uraricoera river, Waikás area"
    },
    "lat": 3.75,
    "lon": -63.61667,
    "approx": true,
    "approxNote": {
      "pt": "Posição aproximada: marcada na foz do rio Aracaçá; a comunidade fica às margens do Uraricoera, na região de Waikás.",
      "en": "Approximate position: marked at the Aracaçá river; the community is on the Uraricoera banks, in the Waikás area."
    },
    "coordSources": [
      {
        "label": "Wikidata Q4783510 · Rio Aracaçá",
        "url": "https://www.wikidata.org/wiki/Q4783510"
      },
      {
        "label": "ISA · Organização Yanomami exige retirada de garimpeiros (2022)",
        "url": "https://site-antigo.socioambiental.org/en/print/7586"
      }
    ],
    "summary": {
      "pt": "Comunidade às margens do Uraricoera, uma das áreas mais devastadas pelo garimpo. Em 2022 a Hutukara denunciou violência de garimpeiros e o sumiço dos moradores; a Polícia Federal disse não ter achado indícios do crime, e o caso segue controverso.",
      "en": "Community on the Uraricoera, one of the areas worst hit by mining. In 2022 Hutukara reported violence by miners and that residents had disappeared; the Federal Police said it found no evidence of the crime, and the case remains disputed."
    },
    "images": [
      {
        "src": "https://upload.wikimedia.org/wikipedia/commons/4/45/Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel%2C_Roraima%2C_por_militares_das_For%C3%A7as_Armadas_-_2023_%2853185282296%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel,_Roraima,_por_militares_das_For%C3%A7as_Armadas_-_2023_(53185282296).jpg",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "Neutralização da pista de pouso que sustentava o garimpo ilegal em Rangel, na Terra Indígena Yanomami, Roraima, por militares das Forças Armadas - 2023",
        "alt": {
          "pt": "Militares inutilizam uma pista de pouso clandestina de garimpo em Rangel, Terra Indígena Yanomami, 2023.",
          "en": "Soldiers disable a clandestine mining airstrip at Rangel, Yanomami Indigenous Territory, 2023."
        }
      }
    ],
    "stats": [],
    "events": [
      {
        "year": "2022",
        "text": {
          "pt": "Hutukara denuncia ataque de garimpeiros; casas queimadas são encontradas. A PF diz não haver indícios.",
          "en": "Hutukara reports an attack by miners; burned houses are found. Federal Police say there is no evidence."
        },
        "sources": [
          {
            "label": "ISA · Organização Yanomami exige retirada de garimpeiros (2022)",
            "url": "https://site-antigo.socioambiental.org/en/print/7586"
          },
          {
            "label": "Congresso em Foco · PF não encontra indícios (2022)",
            "url": "https://www.congressoemfoco.com.br/area/pais/policia-federal-nao-encontra-indicios-de-crime-contra-crianca-yanomami/"
          }
        ]
      }
    ],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@3.75,-63.61667,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "catrimani",
    "name": {
      "pt": "Missão Catrimani",
      "en": "Catrimani mission"
    },
    "river": {
      "pt": "Rio Catrimani",
      "en": "Catrimani river"
    },
    "lat": 1.74083,
    "lon": -62.28639,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q31205651 · Aeródromo Missão Catrimani (SJLU)",
        "url": "https://www.wikidata.org/wiki/Q31205651"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Pista de pouso da Missão Catrimani, no sul da terra Yanomami em Roraima. A região deu nome às operações federais Catrimani contra o garimpo.",
      "en": "Airstrip of the Catrimani mission, in the south of Yanomami land in Roraima. The area gave its name to the federal Catrimani operations against mining."
    },
    "images": [
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Opera%C3%A7%C3%A3o_Catrimani_-_2024_%2853817244491%29.png/960px-Opera%C3%A7%C3%A3o_Catrimani_-_2024_%2853817244491%29.png",
        "page": "https://commons.wikimedia.org/wiki/File:Opera%C3%A7%C3%A3o_Catrimani_-_2024_(53817244491).png",
        "author": "Marinha do Brasil",
        "license": "CC BY-SA 2.0",
        "desc": "A Marinha do Brasil passou a comandar o Estado-Maior Conjunto da Operação “Catrimani II” que, desde 1º de abril, combate o garimpo ilegal na Terra Indígena Yano",
        "alt": {
          "pt": "Operação Catrimani II contra o garimpo ilegal, 2024.",
          "en": "Operation Catrimani II against illegal mining, 2024."
        }
      }
    ],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@1.74083,-62.28639,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "maturaca",
    "name": {
      "pt": "Maturacá",
      "en": "Maturacá"
    },
    "river": {
      "pt": "Serra do Imeri, São Gabriel da Cachoeira (AM)",
      "en": "Imeri range, São Gabriel da Cachoeira (Amazonas)"
    },
    "lat": 0.61639,
    "lon": -66.13111,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q12693884 · Aeródromo Maturacá (SWMK)",
        "url": "https://www.wikidata.org/wiki/Q12693884"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Comunidades Yanomami no lado amazonense, ao pé do Pico da Neblina, o ponto mais alto do Brasil.",
      "en": "Yanomami communities on the Amazonas side, at the foot of Pico da Neblina, Brazil's highest peak."
    },
    "images": [
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dd/Entardecer_em_Maturac%C3%A1.JPG/960px-Entardecer_em_Maturac%C3%A1.JPG",
        "page": "https://commons.wikimedia.org/wiki/File:Entardecer_em_Maturac%C3%A1.JPG",
        "author": "Liana Amin Lima",
        "license": "CC BY-SA 3.0",
        "desc": "Comunidade Maturacá, Terra Indígena Yanomami, AM.",
        "alt": {
          "pt": "Entardecer na comunidade Maturacá, Terra Indígena Yanomami (AM).",
          "en": "Dusk at the Maturacá community, Yanomami Indigenous Territory (AM)."
        }
      },
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Lugar_Sagrado.JPG/960px-Lugar_Sagrado.JPG",
        "page": "https://commons.wikimedia.org/wiki/File:Lugar_Sagrado.JPG",
        "author": "Liana Amin Lima",
        "license": "CC BY-SA 3.0",
        "desc": "Comunidade Maturacá, Terra Indígena Yanomami, AM.",
        "alt": {
          "pt": "Lugar sagrado na comunidade Maturacá (AM).",
          "en": "A sacred place at the Maturacá community (AM)."
        }
      },
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8f/26_05_2021_Foto_do_Dia_%2851206670030%29.jpg/960px-26_05_2021_Foto_do_Dia_%2851206670030%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:26_05_2021_Foto_do_Dia_(51206670030).jpg",
        "author": "Palácio do Planalto from Brasilia, Brasil",
        "license": "CC BY 2.0",
        "desc": "(Maturacá - AM, 24/05/2021) Índios Yanomamis em suas tarefas diárias na Floresta Amazônica.\n\nFoto: Isac Nóbrega/PR",
        "alt": {
          "pt": "Yanomami em atividades do dia a dia em Maturacá (AM), 2021.",
          "en": "Yanomami in daily tasks at Maturacá (AM), 2021."
        }
      },
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/Pico_da_Neblina_%28FAB%29.jpg/960px-Pico_da_Neblina_%28FAB%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Pico_da_Neblina_(FAB).jpg",
        "author": "Força Aérea do Brasil",
        "license": "CC BY 3.0",
        "desc": "Pico da Neblina, Brasil",
        "alt": {
          "pt": "Pico da Neblina, o ponto mais alto do Brasil, dentro do território Yanomami.",
          "en": "Pico da Neblina, Brazil's highest peak, inside Yanomami land."
        }
      }
    ],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@0.61639,-66.13111,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "parafuri",
    "name": {
      "pt": "Parafuri",
      "en": "Parafuri"
    },
    "river": {
      "pt": "Alto Uraricoera",
      "en": "Upper Uraricoera"
    },
    "lat": 3.28806,
    "lon": -63.84306,
    "approx": false,
    "coordSources": [
      {
        "label": "Wikidata Q31205722 · Aeródromo Parafuri (SJMI)",
        "url": "https://www.wikidata.org/wiki/Q31205722"
      },
      {
        "label": "OurAirports (domínio público)",
        "url": "https://ourairports.com/countries/BR/"
      }
    ],
    "summary": {
      "pt": "Pista de pouso (SJMI) no alto Uraricoera, a oeste de Palimiú.",
      "en": "Airstrip (SJMI) on the upper Uraricoera, west of Palimiú."
    },
    "images": [],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@3.28806,-63.84306,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  },
  {
    "id": "toototobi",
    "name": {
      "pt": "Toototobi",
      "en": "Toototobi"
    },
    "river": {
      "pt": "Rio Toototobi (bacia do Demini)",
      "en": "Toototobi river (Demini basin)"
    },
    "lat": 1.56667,
    "lon": -63.55,
    "approx": true,
    "approxNote": {
      "pt": "Posição aproximada: coordenada do rio Toototobi.",
      "en": "Approximate position: coordinate of the Toototobi river."
    },
    "coordSources": [
      {
        "label": "Wikipedia · Toototobi River",
        "url": "https://en.wikipedia.org/wiki/Toototobi_River"
      }
    ],
    "summary": {
      "pt": "Região onde nasceu Davi Kopenawa, perto da fronteira com a Venezuela.",
      "en": "The area where Davi Kopenawa was born, near the Venezuelan border."
    },
    "images": [
      {
        "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/88/Davikopenawa.jpg/960px-Davikopenawa.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Davikopenawa.jpg",
        "author": "Fernando Frazão/Agência Brasil",
        "license": "CC BY 3.0 br",
        "desc": "Davi Kopenawa at 2014 International Literary Festival of Paraty. Photo by Fernando Frazão/Agência Brasil CCBY3.0.",
        "alt": {
          "pt": "Davi Kopenawa Yanomami na FLIP, Paraty, 2014.",
          "en": "Davi Kopenawa Yanomami at the Paraty literary festival, 2014."
        }
      }
    ],
    "stats": [],
    "events": [],
    "explore": [
      {
        "kind": "earth",
        "label": {
          "pt": "Ver em 3D no Google Earth",
          "en": "View in 3D on Google Earth"
        },
        "url": "https://earth.google.com/web/@1.56667,-63.55,400a,9000d,35y,0h,55t,0r"
      },
      {
        "kind": "streetview-nearby",
        "label": {
          "pt": "Street View mais próximo: Boa Vista (RR), fora do território",
          "en": "Nearest Street View: Boa Vista (Roraima), outside the territory"
        },
        "url": "https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=2.8235,-60.6758"
      }
    ]
  }
]

export const YANOMAMI_TERRITORY: {
  stats: PlaceStat[]
  economy: { legal: Bilingual; illegal: Bilingual; sources: SourceLink[] }
  events: PlaceEvent[]
} = {
  "stats": [
    {
      "label": {
        "pt": "Área",
        "en": "Area"
      },
      "value": "9.664.975 ha",
      "sources": [
        {
          "label": "Wikipedia · Terra Indígena Yanomami",
          "url": "https://pt.wikipedia.org/wiki/Terra_Ind%C3%ADgena_Yanomami"
        }
      ]
    },
    {
      "label": {
        "pt": "População (2023)",
        "en": "Population (2023)"
      },
      "value": "31.223",
      "sources": [
        {
          "label": "Wikipedia · Terra Indígena Yanomami",
          "url": "https://pt.wikipedia.org/wiki/Terra_Ind%C3%ADgena_Yanomami"
        }
      ]
    },
    {
      "label": {
        "pt": "Garimpeiros estimados (2022)",
        "en": "Estimated miners (2022)"
      },
      "value": "~20.000",
      "sources": [
        {
          "label": "Wikipedia · Yanomami humanitarian crisis",
          "url": "https://en.wikipedia.org/wiki/Yanomami_humanitarian_crisis"
        }
      ]
    },
    {
      "label": {
        "pt": "Crianças < 5 anos mortas em 2022",
        "en": "Children under 5 who died in 2022"
      },
      "value": "99",
      "sources": [
        {
          "label": "Wikipedia · Yanomami humanitarian crisis",
          "url": "https://en.wikipedia.org/wiki/Yanomami_humanitarian_crisis"
        }
      ]
    }
  ],
  "economy": {
    "legal": {
      "pt": "Caça, pesca, coleta e roças de coivara (mandioca, banana); artesanato.",
      "en": "Hunting, fishing, gathering and swidden gardens (manioc, plantain); handicraft."
    },
    "illegal": {
      "pt": "Garimpo de ouro e cassiterita, com balsas e dragas nos rios, pistas de pouso clandestinas e logística por barco e avião.",
      "en": "Gold and cassiterite mining, with barges and dredges on the rivers, clandestine airstrips and supply by boat and plane."
    },
    "sources": [
      {
        "label": "ISA · Povos Indígenas no Brasil: Yanomami",
        "url": "https://pib.socioambiental.org/en/Povo:Yanomami"
      },
      {
        "label": "Wikipedia · Yanomami humanitarian crisis",
        "url": "https://en.wikipedia.org/wiki/Yanomami_humanitarian_crisis"
      }
    ]
  },
  "events": [
    {
      "year": "1973–76",
      "text": {
        "pt": "Construção da Perimetral Norte corta o sul do território e traz epidemias.",
        "en": "The Perimetral Norte road cuts through the south of the territory and brings epidemics."
      },
      "sources": [
        {
          "label": "Wikipedia · Haximu massacre",
          "url": "https://en.wikipedia.org/wiki/Haximu_massacre"
        },
        {
          "label": "Wikipedia · Davi Kopenawa",
          "url": "https://pt.wikipedia.org/wiki/Davi_Kopenawa"
        }
      ]
    },
    {
      "year": "1987–90",
      "text": {
        "pt": "Corrida do ouro: dezenas de milhares de garimpeiros invadem a terra.",
        "en": "Gold rush: tens of thousands of miners invade the land."
      },
      "sources": [
        {
          "label": "Wikipedia · Haximu massacre",
          "url": "https://en.wikipedia.org/wiki/Haximu_massacre"
        },
        {
          "label": "Wikipedia · Davi Kopenawa",
          "url": "https://pt.wikipedia.org/wiki/Davi_Kopenawa"
        }
      ]
    },
    {
      "year": "1992",
      "text": {
        "pt": "25 de maio: homologação da Terra Indígena Yanomami, com 9,66 milhões de hectares.",
        "en": "May 25: the Yanomami Indigenous Territory is ratified, 9.66 million hectares."
      },
      "sources": [
        {
          "label": "Wikipedia · Terra Indígena Yanomami",
          "url": "https://pt.wikipedia.org/wiki/Terra_Ind%C3%ADgena_Yanomami"
        }
      ]
    },
    {
      "year": "1993",
      "text": {
        "pt": "Massacre de Haximu: 16 Yanomami mortos por garimpeiros; depois julgado como genocídio.",
        "en": "Haximu massacre: 16 Yanomami killed by miners; later ruled a genocide."
      },
      "sources": [
        {
          "label": "Wikipedia · Haximu massacre",
          "url": "https://en.wikipedia.org/wiki/Haximu_massacre"
        }
      ]
    },
    {
      "year": "2021",
      "text": {
        "pt": "Ataques armados de garimpeiros à comunidade de Palimiú, no Uraricoera.",
        "en": "Armed attacks by miners on the Palimiú community, on the Uraricoera."
      },
      "sources": [
        {
          "label": "Hutukara Associação Yanomami · ofício de 17/05/2021 (ISA)",
          "url": "https://site-antigo.socioambiental.org/sites/blog.socioambiental.org/files/nsa/arquivos/oficio_hay_-_novo_conflito_no_palimiu_17-05-2021.pdf"
        }
      ]
    },
    {
      "year": "2023",
      "text": {
        "pt": "Janeiro: o Ministério da Saúde declara emergência sanitária no território; começam as operações federais contra o garimpo.",
        "en": "January: the Health Ministry declares a health emergency in the territory; federal operations against mining begin."
      },
      "sources": [
        {
          "label": "Wikipedia · Yanomami humanitarian crisis",
          "url": "https://en.wikipedia.org/wiki/Yanomami_humanitarian_crisis"
        }
      ]
    }
  ]
}

export const YANOMAMI_CREDITS: { title: string; author: string; license: string; url: string }[] = [
  {
    "title": "Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel,_Roraima,_por_militares_das_For%C3%A7as_Armadas_-_2023_(53185282296).jpg",
    "author": "Marinha do Brasil",
    "license": "CC BY-SA 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:Neutraliza%C3%A7%C3%A3o_da_pista_de_pouso_que_sustentava_o_garimpo_ilegal_em_Rangel,_Roraima,_por_militares_das_For%C3%A7as_Armadas_-_2023_(53185282296).jpg"
  },
  {
    "title": "Opera%C3%A7%C3%A3o_Catrimani_-_2024_(53817244491).png",
    "author": "Marinha do Brasil",
    "license": "CC BY-SA 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:Opera%C3%A7%C3%A3o_Catrimani_-_2024_(53817244491).png"
  },
  {
    "title": "Davikopenawa.jpg",
    "author": "Fernando Frazão/Agência Brasil",
    "license": "CC BY 3.0 br",
    "url": "https://commons.wikimedia.org/wiki/File:Davikopenawa.jpg"
  },
  {
    "title": "Claudia_Andujar_e_Davi_Kopenawa.jpg",
    "author": "Fernando Frazão",
    "license": "CC BY 3.0 br",
    "url": "https://commons.wikimedia.org/wiki/File:Claudia_Andujar_e_Davi_Kopenawa.jpg"
  },
  {
    "title": "Entardecer_em_Maturac%C3%A1.JPG",
    "author": "Liana Amin Lima",
    "license": "CC BY-SA 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Entardecer_em_Maturac%C3%A1.JPG"
  },
  {
    "title": "Lugar_Sagrado.JPG",
    "author": "Liana Amin Lima",
    "license": "CC BY-SA 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Lugar_Sagrado.JPG"
  },
  {
    "title": "26_05_2021_Foto_do_Dia_(51206670030).jpg",
    "author": "Palácio do Planalto from Brasilia, Brasil",
    "license": "CC BY 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:26_05_2021_Foto_do_Dia_(51206670030).jpg"
  },
  {
    "title": "Pico_da_Neblina_(FAB).jpg",
    "author": "Força Aérea do Brasil",
    "license": "CC BY 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Pico_da_Neblina_(FAB).jpg"
  },
  {
    "title": "Opera%C3%A7%C3%A3o_%C3%81gata_Fronteira_Norte_-_2023_(53120754375).jpg",
    "author": "Marinha do Brasil",
    "license": "CC BY-SA 2.0",
    "url": "https://commons.wikimedia.org/wiki/File:Opera%C3%A7%C3%A3o_%C3%81gata_Fronteira_Norte_-_2023_(53120754375).jpg"
  },
  {
    "title": "Gar%C3%A7a_de_eleg%C3%A2ncia.jpg",
    "author": "Suzana Lemos",
    "license": "CC BY-SA 4.0",
    "url": "https://commons.wikimedia.org/wiki/File:Gar%C3%A7a_de_eleg%C3%A2ncia.jpg"
  }
]

export const placeById = (id: string) => YANOMAMI_PLACES.find((p) => p.id === id)
