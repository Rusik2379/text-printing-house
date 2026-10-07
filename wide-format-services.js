window.TEXT_WIDE_SERVICES = {
  "5.1": {
    "id": "5.1",
    "name": "Печать баннеров",
    "path": "shirokiy-format/bannery/",
    "model": "banner",
    "kind": "area",
    "minimum": 600,
    "pricingGroup": "wide-banner",
    "defaults": {
      "print": "interior",
      "material": "cast",
      "width": 1000,
      "height": 1000,
      "quantity": 1
    },
    "prints": {
      "interior": "Интерьерная печать"
    },
    "materials": {
      "cast": "Литой баннер",
      "edge": "Баннер с проклейкой края",
      "eyelets": "С проклейкой и люверсами"
    },
    "materialsByPrint": {
      "interior": [
        "cast",
        "edge",
        "eyelets"
      ]
    },
    "sizes": [
      [
        1000,
        1000
      ],
      [
        1500,
        1000
      ],
      [
        2000,
        1000
      ],
      [
        3000,
        1000
      ],
      [
        3000,
        2000
      ],
      [
        4000,
        3000
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-bannery.webp"
  },
  "5.2": {
    "id": "5.2",
    "name": "Печать постеров",
    "path": "shirokiy-format/postery/",
    "model": "poster",
    "kind": "area",
    "minimum": 600,
    "pricingGroup": "wide-poster",
    "defaults": {
      "print": "interior",
      "material": "paper",
      "width": 1000,
      "height": 1000,
      "quantity": 1
    },
    "prints": {
      "interior": "Интерьерная печать"
    },
    "materials": {
      "paper": "Постерная бумага"
    },
    "materialsByPrint": {
      "interior": [
        "paper"
      ]
    },
    "sizes": [
      [
        420,
        594
      ],
      [
        594,
        841
      ],
      [
        841,
        1189
      ],
      [
        500,
        700
      ],
      [
        700,
        1000
      ],
      [
        1000,
        1000
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-postery.webp"
  },
  "5.3": {
    "id": "5.3",
    "name": "Печать плакатов",
    "path": "shirokiy-format/plakaty/",
    "model": "poster",
    "kind": "area",
    "minimum": 600,
    "pricingGroup": "wide-poster",
    "defaults": {
      "print": "interior",
      "material": "paper",
      "width": 1000,
      "height": 1000,
      "quantity": 1
    },
    "prints": {
      "interior": "Интерьерная печать"
    },
    "materials": {
      "paper": "Постерная бумага"
    },
    "materialsByPrint": {
      "interior": [
        "paper"
      ]
    },
    "sizes": [
      [
        420,
        594
      ],
      [
        594,
        841
      ],
      [
        841,
        1189
      ],
      [
        500,
        700
      ],
      [
        700,
        1000
      ],
      [
        1000,
        1000
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-plakaty.webp"
  },
  "5.4": {
    "id": "5.4",
    "name": "Печать на холсте",
    "path": "shirokiy-format/pechat-na-holste/",
    "model": "canvas",
    "kind": "area",
    "minimum": 600,
    "pricingGroup": "wide-canvas",
    "defaults": {
      "print": "uv",
      "material": "canvas",
      "width": 300,
      "height": 400,
      "quantity": 10
    },
    "prints": {
      "uv": "УФ-печать"
    },
    "materials": {
      "canvas": "Синтетический матовый холст",
      "framed": "Матовый холст с рамкой"
    },
    "materialsByPrint": {
      "uv": [
        "canvas",
        "framed"
      ]
    },
    "sizes": [
      [
        300,
        400
      ],
      [
        400,
        500
      ],
      [
        500,
        600
      ],
      [
        500,
        700
      ],
      [
        600,
        1000
      ],
      [
        1000,
        1000
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-pechat-na-holste.webp"
  },
  "5.5": {
    "id": "5.5",
    "name": "Печать на самоклеящейся плёнке",
    "path": "shirokiy-format/samokleyashchayasya-plenka/",
    "model": "film",
    "kind": "area",
    "minimum": 600,
    "pricingGroup": "wide-film",
    "defaults": {
      "print": "interior",
      "material": "matte",
      "width": 1000,
      "height": 1000,
      "quantity": 1
    },
    "prints": {
      "interior": "Интерьерная печать",
      "uv": "УФ-печать"
    },
    "materials": {
      "matte": "Белая матовая плёнка",
      "gloss": "Белая глянцевая плёнка",
      "clearMatte": "Прозрачная матовая плёнка",
      "clearGloss": "Прозрачная глянцевая плёнка",
      "perforated": "Перфорированная плёнка"
    },
    "materialsByPrint": {
      "interior": [
        "matte",
        "gloss"
      ],
      "uv": [
        "matte",
        "gloss",
        "clearMatte",
        "clearGloss",
        "perforated"
      ]
    },
    "sizes": [
      [
        300,
        300
      ],
      [
        500,
        500
      ],
      [
        1000,
        1000
      ],
      [
        1000,
        1500
      ],
      [
        1500,
        2000
      ],
      [
        2000,
        2000
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-samokleyashchayasya-plenka.webp"
  },
  "5.6": {
    "id": "5.6",
    "name": "Наклейки на авто",
    "path": "shirokiy-format/nakleyki-na-avto/",
    "model": "cut",
    "kind": "cut",
    "minimum": 600,
    "pricingGroup": "wide-cut",
    "defaults": {
      "print": "cut",
      "material": "white",
      "width": 1000,
      "height": 600,
      "quantity": 1,
      "complexity": "complex"
    },
    "prints": {
      "cut": "Плоттерная резка"
    },
    "materials": {
      "white": "Белая плёнка",
      "color": "Цветная плёнка",
      "metal": "Металлизированная плёнка"
    },
    "materialsByPrint": {
      "cut": [
        "white",
        "color",
        "metal"
      ]
    },
    "sizes": [
      [
        200,
        200
      ],
      [
        300,
        300
      ],
      [
        500,
        500
      ],
      [
        1000,
        600
      ],
      [
        1500,
        600
      ],
      [
        2000,
        600
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-nakleyki-na-avto.webp"
  },
  "5.7": {
    "id": "5.7",
    "name": "Наклейки на стекло",
    "path": "shirokiy-format/nakleyki-na-steklo/",
    "model": "cut",
    "kind": "cut",
    "minimum": 600,
    "pricingGroup": "wide-cut",
    "defaults": {
      "print": "cut",
      "material": "white",
      "width": 1000,
      "height": 600,
      "quantity": 1,
      "complexity": "complex"
    },
    "prints": {
      "cut": "Плоттерная резка"
    },
    "materials": {
      "white": "Белая плёнка",
      "color": "Цветная плёнка",
      "metal": "Металлизированная плёнка"
    },
    "materialsByPrint": {
      "cut": [
        "white",
        "color",
        "metal"
      ]
    },
    "sizes": [
      [
        200,
        200
      ],
      [
        300,
        300
      ],
      [
        500,
        500
      ],
      [
        1000,
        600
      ],
      [
        1500,
        600
      ],
      [
        2000,
        600
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-nakleyki-na-steklo.webp"
  },
  "5.8": {
    "id": "5.8",
    "name": "Накатка на ПВХ",
    "path": "shirokiy-format/nakatka-na-pvh/",
    "model": "pvc",
    "kind": "mount",
    "minimum": 600,
    "pricingGroup": "wide-pvc",
    "defaults": {
      "print": "solvent",
      "material": "pvc",
      "width": 210,
      "height": 297,
      "quantity": 3,
      "thickness": "3"
    },
    "prints": {
      "solvent": "Сольвентная печать",
      "uv": "УФ-печать"
    },
    "materials": {
      "pvc": "ПВХ"
    },
    "materialsByPrint": {
      "solvent": [
        "pvc"
      ],
      "uv": [
        "pvc"
      ]
    },
    "sizes": [
      [
        210,
        297
      ],
      [
        420,
        594
      ],
      [
        500,
        500
      ],
      [
        594,
        841
      ],
      [
        1000,
        1000
      ],
      [
        1450,
        2000
      ]
    ],
    "quantities": [
      1,
      2,
      3,
      5,
      10,
      25
    ],
    "hero": "wide-hero-nakatka-na-pvh.webp"
  },
  "5.9": {
    "id": "5.9",
    "name": "Накатка на пенокартон",
    "path": "shirokiy-format/nakatka-na-penokarton/",
    "model": "foam",
    "kind": "mount",
    "minimum": 600,
    "pricingGroup": "wide-foam",
    "defaults": {
      "print": "solvent",
      "material": "foam",
      "width": 600,
      "height": 1200,
      "quantity": 25,
      "thickness": "5"
    },
    "prints": {
      "solvent": "Сольвентная печать",
      "uv": "УФ-печать"
    },
    "materials": {
      "foam": "Пенокартон"
    },
    "materialsByPrint": {
      "solvent": [
        "foam"
      ],
      "uv": [
        "foam"
      ]
    },
    "sizes": [
      [
        200,
        200
      ],
      [
        500,
        500
      ],
      [
        600,
        1200
      ],
      [
        750,
        750
      ],
      [
        1000,
        1000
      ],
      [
        1450,
        1350
      ]
    ],
    "quantities": [
      1,
      2,
      5,
      10,
      25,
      50
    ],
    "hero": "wide-hero-nakatka-na-penokarton.webp"
  }
};
