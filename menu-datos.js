/* Copia de respaldo del menú (mismo formato que servidor-pedidos/datos/menu.json).
   La web la usa si no puede leer el menú en vivo del servidor.
   Se puede editar con: python3 editor/editor_menu.py */
window.MENU_RESPALDO = {
 "version": 11,
 "config": {
  "zonaHoraria": "America/Managua",
  "horario": {
   "desayuno": {
    "desde": "06:30",
    "hasta": "10:30"
   },
   "almuerzo": {
    "desde": "10:30",
    "hasta": "21:00"
   },
   "bar": {
    "desde": "10:30",
    "hasta": "21:00"
   }
  },
  "moneda": "C$",
  "tipoCambio": 36.62,
  "iva": 0.15,
  "idiomaBase": "es",
  "hotel": {
   "direccion": "Km 226.5 carretera Panamericana Norte, contiguo a gasolinera Uno Ramos. Ocotal, Nueva Segovia.",
   "telefonos": [
    {
     "texto": "2732-2668",
     "tel": "+50527322668"
    },
    {
     "texto": "2732-2669",
     "tel": "+50527322669"
    }
   ],
   "celular": {
    "texto": "8642-7663",
    "tel": "+50586427663"
   },
   "web": "https://www.hotelfronteraocotal.com",
   "webTexto": "hotelfronteraocotal.com",
   "correo": "hotelfronterasa@yahoo.com",
   "lema": "¡Su límite para descansar!",
   "nombre": "Hotel Frontera",
   "restaurante": "Las Margaritas",
   "ubicacion": "JGPC+297, NIC-15, Ocotal, Nicaragua"
  },
  "bebidasDesayuno": [
   "jugo-naranja",
   "cafe",
   "te"
  ]
 },
 "categorias": {
  "des-tipicos": {
   "icono": "huevo",
   "nombre": {
    "es": "Desayunos típicos"
   },
   "resumen": {
    "es": "Gallo pinto, huevos y maduro"
   },
   "incluye": "desayuno",
   "sug": [
    "x-chorizo",
    "x-gallopinto"
   ],
   "platos": [
    {
     "id": "criollo",
     "p": 165,
     "t": [
      "popular",
      "tipico"
     ],
     "n": {
      "es": "Desayuno criollo"
     },
     "d": {
      "es": "Dos huevos al gusto, frijoles fritos, chorizo criollo, queso y maduro."
     },
     "sug": [
      "x-tostadas",
      "x-salsa"
     ]
    },
    {
     "id": "segovia",
     "p": 144,
     "t": [
      "tipico"
     ],
     "n": {
      "es": "Desayuno Segovia"
     },
     "d": {
      "es": "Gallo pinto, crema, queso y maduro: el clásico nica."
     },
     "sug": [
      "x-huevos",
      "x-chorizo"
     ]
    },
    {
     "id": "rancheros",
     "p": 147,
     "sug": [
      "x-gallopinto",
      "x-chorizo"
     ],
     "n": {
      "es": "Huevos rancheros"
     },
     "d": {
      "es": "Dos huevos con salsa, frijoles molidos y tostadas."
     }
    },
    {
     "id": "quesadillas",
     "p": 165,
     "n": {
      "es": "Quesadillas de queso y pollo"
     },
     "d": {
      "es": "Con pico de gallo, frijoles molidos y crema."
     },
     "sug": [
      "x-huevos",
      "x-salsa"
     ]
    },
    {
     "id": "omelette",
     "p": 152,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Omelette Frontera"
     },
     "d": {
      "es": "Dos huevos con jamón y queso amarillo, dos tostadas, jalea y mantequilla."
     },
     "sug": [
      "x-gallopinto",
      "x-chorizo"
     ]
    }
   ]
  },
  "des-dulces": {
   "icono": "panqueques",
   "nombre": {
    "es": "Dulces y ligeros"
   },
   "resumen": {
    "es": "Waffle, panqueques y frutas"
   },
   "nota": {
    "es": "Incluyen una bebida a elegir, excepto el plato de frutas."
   },
   "sug": [
    "batido-leche",
    "x-huevos"
   ],
   "platos": [
    {
     "id": "waffle",
     "p": 147,
     "incluye": "desayuno",
     "sug": [
      "x-huevos",
      "batido-leche"
     ],
     "n": {
      "es": "Waffle"
     },
     "d": {
      "es": "Dorado por fuera, suave por dentro."
     }
    },
    {
     "id": "continental",
     "p": 125,
     "incluye": "desayuno",
     "sug": [
      "x-huevos",
      "x-gallopinto"
     ],
     "n": {
      "es": "Desayuno continental"
     },
     "d": {
      "es": "Tres tostadas con jalea y mantequilla."
     }
    },
    {
     "id": "especial",
     "p": 127,
     "incluye": "desayuno",
     "sug": [
      "x-huevos",
      "batido-leche"
     ],
     "n": {
      "es": "Especial de panqueques"
     },
     "d": {
      "es": "Dos panqueques con miel y mantequilla."
     },
     "t": [
      "popular"
     ]
    },
    {
     "id": "frutas",
     "p": 147,
     "sug": [
      "cafe-leche",
      "x-tostadas"
     ],
     "n": {
      "es": "Plato de frutas"
     },
     "d": {
      "es": "Papaya, sandía, piña y banano, según la temporada. Con miel de abeja, si la desea."
     },
     "t": [
      "popular"
     ]
    }
   ]
  },
  "des-extras": {
   "icono": "pan",
   "nombre": {
    "es": "Para agregar"
   },
   "resumen": {
    "es": "Gallo pinto, huevos y chorizo"
   },
   "nota": {
    "es": "Complete su desayuno."
   },
   "platos": [
    {
     "id": "x-chorizo",
     "p": 73,
     "n": {
      "es": "Chorizo criollo"
     }
    },
    {
     "id": "x-gallopinto",
     "p": 59,
     "n": {
      "es": "Gallo pinto"
     }
    },
    {
     "id": "x-huevos",
     "p": 56,
     "n": {
      "es": "Dos huevos a su gusto"
     }
    },
    {
     "id": "x-tostadas",
     "p": 40,
     "n": {
      "es": "Tostadas"
     }
    },
    {
     "id": "x-salsa",
     "p": 40,
     "n": {
      "es": "Salsa ranchera"
     }
    },
    {
     "id": "x-panqueque",
     "p": 59,
     "n": {
      "es": "Un panqueque"
     }
    },
    {
     "id": "x-waffle",
     "p": 59,
     "n": {
      "es": "Waffle extra"
     }
    }
   ],
   "sinBebidas": true
  },
  "calientes": {
   "icono": "taza",
   "nombre": {
    "es": "Café y bebidas calientes"
   },
   "resumen": {
    "es": "Café, chocolate y té"
   },
   "sug": [
    "bunuelos",
    "cikolat"
   ],
   "platos": [
    {
     "id": "cafe-leche",
     "p": 45,
     "n": {
      "es": "Café con leche"
     }
    },
    {
     "id": "cafe",
     "p": 30,
     "n": {
      "es": "Café"
     },
     "d": {
      "es": "Recién hecho."
     }
    },
    {
     "id": "te",
     "p": 55,
     "n": {
      "es": "Té caliente"
     }
    },
    {
     "id": "chocolate",
     "p": 55,
     "n": {
      "es": "Chocolate caliente"
     }
    }
   ],
   "sinBebidas": true
  },
  "frias": {
   "icono": "vaso",
   "nombre": {
    "es": "Jugos, batidos y refrescos"
   },
   "resumen": {
    "es": "Batidos, limonada y jugos"
   },
   "platos": [
    {
     "id": "batido-leche",
     "p": 100,
     "n": {
      "es": "Batido con leche"
     },
     "d": {
      "es": "Espeso y bien frío. Elija el sabor."
     },
     "op": [
      {
       "es": "Banano"
      },
      {
       "es": "Papaya"
      },
      {
       "es": "Vainilla"
      },
      {
       "es": "Avena"
      }
     ]
    },
    {
     "id": "limonada",
     "p": 90,
     "n": {
      "es": "Limonada"
     },
     "d": {
      "es": "Natural y bien fría."
     }
    },
    {
     "id": "jugo-naranja",
     "p": 44,
     "n": {
      "es": "Jugo de naranja"
     }
    },
    {
     "id": "jamaica",
     "p": 70,
     "n": {
      "es": "Té rosa de Jamaica"
     }
    },
    {
     "id": "gaseosa",
     "p": 40,
     "n": {
      "es": "Gaseosas"
     },
     "op": [
      {
       "es": "Coca-Cola"
      },
      {
       "es": "Canada Dry Ginger Ale"
      },
      {
       "es": "Canada Dry"
      },
      {
       "es": "Fanta naranja"
      },
      {
       "es": "Fanta uva"
      },
      {
       "es": "Rojita"
      },
      {
       "es": "Fresca"
      }
     ]
    },
    {
     "id": "agua",
     "p": 30,
     "n": {
      "es": "Agua purificada"
     }
    },
    {
     "id": "batido-natural",
     "p": 90,
     "n": {
      "es": "Batido natural"
     },
     "d": {
      "es": "De fruta, sin leche."
     }
    }
   ],
   "sinBebidas": true
  },
  "entradas": {
   "icono": "ceviche",
   "nombre": {
    "es": "Entradas"
   },
   "resumen": {
    "es": "Ceviches y tostones"
   },
   "sug": [
    "michelada",
    "limonada"
   ],
   "platos": [
    {
     "id": "ceviche-mixto",
     "p": 370,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Ceviche mixto"
     }
    },
    {
     "id": "ceviche-camaron",
     "p": 270,
     "n": {
      "es": "Ceviche de camarón"
     }
    },
    {
     "id": "ceviche-corvina",
     "p": 270,
     "n": {
      "es": "Ceviche de corvina"
     }
    },
    {
     "id": "coctel-camarones",
     "p": 270,
     "n": {
      "es": "Coctel de camarones"
     }
    },
    {
     "id": "papas",
     "p": 120,
     "n": {
      "es": "Papas fritas"
     },
     "d": {
      "es": "Doradas y crujientes. Para compartir."
     }
    },
    {
     "id": "tostones",
     "p": 120,
     "t": [
      "tipico"
     ],
     "n": {
      "es": "Tostones con queso"
     }
    }
   ]
  },
  "ensaladas": {
   "icono": "ensalada",
   "nombre": {
    "es": "Ensaladas"
   },
   "resumen": {
    "es": "Chef, pollo y atún"
   },
   "sug": [
    "crema-tomate",
    "limonada"
   ],
   "platos": [
    {
     "id": "ens-chef",
     "p": 280,
     "n": {
      "es": "Ensalada chef"
     }
    },
    {
     "id": "ens-atun",
     "p": 280,
     "n": {
      "es": "Ensalada de atún"
     }
    },
    {
     "id": "vegetales",
     "p": 120,
     "n": {
      "es": "Vegetales de temporada"
     },
     "d": {
      "es": "Los vegetales frescos de la temporada."
     }
    },
    {
     "id": "ens-pollo",
     "p": 280,
     "n": {
      "es": "Ensalada de pollo"
     }
    }
   ]
  },
  "sopas": {
   "icono": "sopa",
   "nombre": {
    "es": "Cremas y sopas"
   },
   "resumen": {
    "es": "Sopa de mariscos y consomés"
   },
   "sug": [
    "tostones",
    "limonada"
   ],
   "platos": [
    {
     "id": "sopa-mariscos",
     "p": 330,
     "n": {
      "es": "Sopa de mariscos"
     },
     "sug": [
      "tostones",
      "cer-nac"
     ]
    },
    {
     "id": "consome-camaron",
     "p": 270,
     "n": {
      "es": "Consomé de camarón"
     },
     "d": {
      "es": "Caldo concentrado de camarón."
     }
    },
    {
     "id": "crema-tomate",
     "p": 150,
     "n": {
      "es": "Crema de tomate"
     },
     "d": {
      "es": "Suave y aterciopelada."
     },
     "sug": [
      "emp-jyq",
      "limonada"
     ]
    },
    {
     "id": "crema-zanahoria",
     "p": 150,
     "n": {
      "es": "Crema de zanahoria"
     },
     "d": {
      "es": "Suave, con el dulzor natural de la zanahoria."
     },
     "sug": [
      "ens-pollo",
      "limonada"
     ]
    },
    {
     "id": "consome-pollo",
     "p": 220,
     "n": {
      "es": "Consomé de pollo"
     },
     "d": {
      "es": "Caldo claro de pollo."
     },
     "sug": [
      "ens-chef",
      "limonada"
     ]
    },
    {
     "id": "consome-res",
     "p": 240,
     "n": {
      "es": "Consomé de res"
     },
     "d": {
      "es": "Caldo claro y concentrado de res."
     },
     "sug": [
      "ens-chef",
      "limonada"
     ]
    },
    {
     "id": "sopa-pollo",
     "p": 260,
     "n": {
      "es": "Sopa de pollo"
     }
    }
   ]
  },
  "aves": {
   "icono": "muslo",
   "nombre": {
    "es": "Aves"
   },
   "resumen": {
    "es": "Cordon bleu y pollo a su gusto"
   },
   "incluye": "fuerte",
   "sug": [
    "vino-moras",
    "crema-tomate"
   ],
   "platos": [
    {
     "id": "cordon-bleu",
     "p": 420,
     "n": {
      "es": "Cordon bleu"
     }
    },
    {
     "id": "pollo",
     "p": 395,
     "n": {
      "es": "Pollo a su gusto"
     },
     "d": {
      "es": "A la plancha, empanizado o en salsa de hongos."
     },
     "op": [
      {
       "es": "A la plancha"
      },
      {
       "es": "Empanizado"
      },
      {
       "es": "En salsa de hongos"
      }
     ]
    }
   ]
  },
  "carnes": {
   "icono": "bistec",
   "nombre": {
    "es": "Carnes"
   },
   "resumen": {
    "es": "Churrasco, brochetas y cerdo"
   },
   "incluye": "fuerte",
   "sug": [
    "vino-undurraga",
    "cer-nac"
   ],
   "platos": [
    {
     "id": "surtido",
     "p": 586,
     "t": [
      "casa"
     ],
     "n": {
      "es": "Surtido Frontera"
     },
     "d": {
      "es": "Un poco de todo: la selección de carnes de la casa."
     }
    },
    {
     "id": "lengua",
     "p": 490,
     "n": {
      "es": "Lengua en salsa"
     },
     "t": [
      "casa"
     ]
    },
    {
     "id": "brocheta-mixta",
     "p": 440,
     "n": {
      "es": "Brocheta mixta"
     }
    },
    {
     "id": "brocheta-pollo",
     "p": 390,
     "n": {
      "es": "Brocheta de pollo"
     }
    },
    {
     "id": "brocheta-res",
     "p": 410,
     "n": {
      "es": "Brocheta de res"
     }
    },
    {
     "id": "cerdo",
     "p": 440,
     "n": {
      "es": "Chuleta o costilla de cerdo ahumada"
     },
     "op": [
      {
       "es": "Chuleta"
      },
      {
       "es": "Costilla"
      }
     ]
    },
    {
     "id": "churrasco",
     "p": 480,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Res a su gusto"
     },
     "d": {
      "es": "Churrasco, en salsa jalapeña, encebollado o a la plancha."
     },
     "op": [
      {
       "es": "Churrasco"
      },
      {
       "es": "En salsa jalapeña"
      },
      {
       "es": "Encebollado"
      },
      {
       "es": "A la plancha"
      }
     ]
    }
   ]
  },
  "mariscos": {
   "icono": "pez",
   "nombre": {
    "es": "Mariscos"
   },
   "resumen": {
    "es": "Camarones y corvina"
   },
   "incluye": "fuerte",
   "sug": [
    "vino-esmeralda",
    "limonada"
   ],
   "platos": [
    {
     "id": "camarones",
     "p": 480,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Camarones a su gusto"
     },
     "d": {
      "es": "Empanizados, al ajillo, a la plancha o a la diabla (picantes)."
     },
     "op": [
      {
       "es": "Empanizados"
      },
      {
       "es": "Al ajillo"
      },
      {
       "es": "A la plancha"
      },
      {
       "es": "A la diabla"
      }
     ]
    },
    {
     "id": "corvina",
     "p": 450,
     "n": {
      "es": "Corvina"
     },
     "d": {
      "es": "Empanizada, al ajillo o a la plancha."
     },
     "op": [
      {
       "es": "Empanizada"
      },
      {
       "es": "Al ajillo"
      },
      {
       "es": "A la plancha"
      }
     ]
    },
    {
     "id": "pasta-camarones",
     "p": 480,
     "incluye": "",
     "n": {
      "es": "Pasta con camarones"
     },
     "d": {
      "es": "No incluye ensalada, arroz ni papas."
     }
    }
   ],
   "nota": {
    "es": "Los platos de camarones y corvina incluyen ensalada, arroz y papas. La pasta con camarones no los incluye."
   }
  },
  "sandwiches": {
   "icono": "hamburguesa",
   "nombre": {
    "es": "Hamburguesas y emparedados"
   },
   "resumen": {
    "es": "Hamburguesa Frontera y paninis"
   },
   "sug": [
    "papas",
    "batido-leche"
   ],
   "platos": [
    {
     "id": "hamb-frontera",
     "p": 200,
     "t": [
      "popular",
      "casa"
     ],
     "n": {
      "es": "Hamburguesa Frontera"
     },
     "d": {
      "es": "La hamburguesa insignia de la casa."
     }
    },
    {
     "id": "hamb-res",
     "p": 150,
     "n": {
      "es": "Hamburguesa de res"
     }
    },
    {
     "id": "hamb-pollo",
     "p": 140,
     "n": {
      "es": "Hamburguesa de pollo"
     }
    },
    {
     "id": "emp-simple",
     "p": 100,
     "n": {
      "es": "Emparedado sencillo"
     },
     "d": {
      "es": "De pollo, de queso o de jamón."
     },
     "op": [
      {
       "es": "Pollo"
      },
      {
       "es": "Queso"
      },
      {
       "es": "Jamón"
      }
     ]
    },
    {
     "id": "emp-jyq",
     "p": 110,
     "n": {
      "es": "Emparedado de jamón y queso"
     }
    },
    {
     "id": "paninis",
     "p": 220,
     "t": [
      "casa"
     ],
     "n": {
      "es": "Paninis de la región"
     },
     "d": {
      "es": "Elija Norteño, Hípico o Segovia."
     },
     "op": [
      {
       "es": "Norteño"
      },
      {
       "es": "Hípico"
      },
      {
       "es": "Segovia"
      }
     ]
    }
   ]
  },
  "ninos": {
   "icono": "estrella",
   "nombre": {
    "es": "Menú infantil"
   },
   "resumen": {
    "es": "Deditos y alitas"
   },
   "sug": [
    "batido-leche",
    "helado"
   ],
   "platos": [
    {
     "id": "deditos-pollo",
     "p": 260,
     "n": {
      "es": "Deditos de pollo"
     }
    },
    {
     "id": "deditos-pescado",
     "p": 270,
     "n": {
      "es": "Deditos de pescado"
     }
    },
    {
     "id": "alitas",
     "p": 195,
     "n": {
      "es": "Alitas"
     },
     "d": {
      "es": "Empanizadas o picantes."
     },
     "op": [
      {
       "es": "Empanizadas"
      },
      {
       "es": "Picantes"
      }
     ]
    }
   ]
  },
  "postres": {
   "icono": "helado",
   "nombre": {
    "es": "Postres"
   },
   "resumen": {
    "es": "Affogato, buñuelos y helado"
   },
   "sug": [
    "cafe-leche",
    "te"
   ],
   "platos": [
    {
     "id": "affogato",
     "p": 130,
     "t": [
      "casa"
     ],
     "n": {
      "es": "Affogato Frontera"
     },
     "sug": [
      "agua"
     ]
    },
    {
     "id": "helado",
     "p": 90,
     "n": {
      "es": "Copa de helado"
     },
     "d": {
      "es": "Helado servido en copa."
     }
    },
    {
     "id": "bunuelos",
     "p": 70,
     "t": [
      "tipico"
     ],
     "n": {
      "es": "Buñuelos en miel"
     }
    },
    {
     "id": "cafe-bombon",
     "p": 120,
     "n": {
      "es": "Café bombón"
     },
     "sug": [
      "agua"
     ]
    },
    {
     "id": "cikolat",
     "p": 108,
     "n": {
      "es": "Cikolat Frontera"
     }
    }
   ],
   "sinBebidas": true
  },
  "cocteles": {
   "icono": "margarita",
   "nombre": {
    "es": "Cócteles"
   },
   "resumen": {
    "es": "Clásicos, michelada y sangría"
   },
   "sug": [
    "tostones",
    "ceviche-mixto"
   ],
   "platos": [
    {
     "id": "margarita",
     "p": 256,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Margarita"
     }
    },
    {
     "id": "caipiroska",
     "p": 256,
     "n": {
      "es": "Caipiroska"
     }
    },
    {
     "id": "bloody-mary",
     "p": 256,
     "n": {
      "es": "Bloody Mary"
     }
    },
    {
     "id": "laguna-azul",
     "p": 256,
     "n": {
      "es": "Laguna azul"
     }
    },
    {
     "id": "michelada",
     "p": 190,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Michelada"
     },
     "op": [
      {
       "es": "Toña"
      },
      {
       "es": "Victoria"
      },
      {
       "es": "Miller"
      }
     ]
    },
    {
     "id": "sangria",
     "p": 240,
     "t": [
      "casa"
     ],
     "n": {
      "es": "Sangría Frontera"
     }
    }
   ],
   "sinBebidas": true
  },
  "frutales": {
   "icono": "frutal",
   "nombre": {
    "es": "Frutales y cremosos"
   },
   "resumen": {
    "es": "Piña colada y daiquirís"
   },
   "sug": [
    "tostones",
    "papas"
   ],
   "platos": [
    {
     "id": "pina-colada",
     "p": 220,
     "n": {
      "es": "Piña colada"
     }
    },
    {
     "id": "daiquiri",
     "p": 220,
     "n": {
      "es": "Daiquirí"
     },
     "op": [
      {
       "es": "Fresa"
      },
      {
       "es": "Mango"
      }
     ]
    },
    {
     "id": "pantera-rosa",
     "p": 220,
     "n": {
      "es": "Pantera rosa"
     },
     "d": {
      "es": "Cremoso, dulce y rosado."
     }
    }
   ],
   "sinBebidas": true
  },
  "cervezas": {
   "icono": "cerveza",
   "nombre": {
    "es": "Cervezas"
   },
   "resumen": {
    "es": "Toña, Victoria y cervezas importadas"
   },
   "sug": [
    "tostones",
    "ceviche-mixto"
   ],
   "platos": [
    {
     "id": "cer-imp",
     "p": 120,
     "n": {
      "es": "Cerveza importada"
     },
     "d": {
      "es": "Heineken, Corona o Sol."
     },
     "op": [
      {
       "es": "Heineken"
      },
      {
       "es": "Corona"
      },
      {
       "es": "Sol"
      }
     ]
    },
    {
     "id": "smirnoff",
     "p": 128,
     "n": {
      "es": "Smirnoff o Bliss"
     },
     "d": {
      "es": "Bebidas saborizadas, bien frías."
     },
     "op": [
      {
       "es": "Smirnoff"
      },
      {
       "es": "Bliss"
      }
     ]
    },
    {
     "id": "seltzer",
     "p": 75,
     "n": {
      "es": "Seltzer, Adán o Boreal"
     },
     "d": {
      "es": "Ligeras y refrescantes."
     },
     "op": [
      {
       "es": "Seltzer"
      },
      {
       "es": "Adán"
      },
      {
       "es": "Boreal"
      }
     ]
    },
    {
     "id": "cer-nac",
     "p": 65,
     "t": [
      "popular"
     ],
     "n": {
      "es": "Cerveza nacional"
     },
     "d": {
      "es": "Toña o Victoria, bien helada."
     },
     "op": [
      {
       "es": "Toña"
      },
      {
       "es": "Victoria"
      }
     ]
    }
   ],
   "sinBebidas": true
  },
  "vinos": {
   "icono": "vino",
   "nombre": {
    "es": "Vinos"
   },
   "resumen": {
    "es": "Tintos, blancos y rosado"
   },
   "nota": {
    "es": "Precio por botella."
   },
   "sug": [
    "surtido",
    "camarones"
   ],
   "platos": [
    {
     "id": "vino-linda",
     "p": 850,
     "n": {
      "es": "Linda Rosé"
     },
     "d": {
      "es": "Vino rosado."
     },
     "sug": [
      "camarones",
      "pollo"
     ]
    },
    {
     "id": "vino-undurraga",
     "p": 735,
     "n": {
      "es": "Undurraga"
     },
     "d": {
      "es": "Vino chileno, tinto o blanco."
     },
     "op": [
      {
       "es": "Tinto"
      },
      {
       "es": "Blanco"
      }
     ]
    },
    {
     "id": "vino-moras",
     "p": 735,
     "n": {
      "es": "Finca Las Moras"
     },
     "d": {
      "es": "Vino argentino, tinto o blanco."
     },
     "op": [
      {
       "es": "Tinto"
      },
      {
       "es": "Blanco"
      }
     ]
    },
    {
     "id": "vino-esmeralda",
     "p": 735,
     "n": {
      "es": "Viña Esmeralda"
     },
     "sug": [
      "camarones",
      "corvina"
     ]
    }
   ],
   "sinBebidas": true
  },
  "ron": {
   "icono": "botella",
   "nombre": {
    "es": "Ron Flor de Caña"
   },
   "resumen": {
    "es": "El ron nicaragüense"
   },
   "sug": [
    "gaseosa@0",
    "tostones"
   ],
   "platos": [
    {
     "id": "centenario",
     "t": [
      "popular"
     ],
     "n": {
      "es": "Centenario 12 años"
     },
     "pres": [
      [
       "botella",
       2937
      ],
      [
       "media",
       1468
      ],
      [
       "trago",
       146
      ]
     ]
    },
    {
     "id": "gran-reserva",
     "n": {
      "es": "Gran Reserva"
     },
     "pres": [
      [
       "media",
       458
      ],
      [
       "trago",
       75
      ]
     ]
    },
    {
     "id": "extra-lite",
     "n": {
      "es": "Extra Lite"
     },
     "pres": [
      [
       "media",
       410
      ],
      [
       "trago",
       70
      ]
     ]
    }
   ],
   "sinBebidas": true
  },
  "whisky": {
   "icono": "rocas",
   "nombre": {
    "es": "Whisky"
   },
   "resumen": {
    "es": "Chivas y Johnnie Walker"
   },
   "sug": [
    "agua",
    "tostones"
   ],
   "platos": [
    {
     "id": "chivas",
     "n": {
      "es": "Chivas Regal"
     },
     "pres": [
      [
       "botella",
       2930
      ],
      [
       "media",
       1465
      ],
      [
       "trago",
       165
      ]
     ]
    },
    {
     "id": "jw-negro",
     "n": {
      "es": "Johnnie Walker Negro"
     },
     "pres": [
      [
       "botella",
       2930
      ],
      [
       "media",
       1465
      ],
      [
       "trago",
       165
      ]
     ]
    },
    {
     "id": "jw-rojo",
     "n": {
      "es": "Johnnie Walker Rojo"
     },
     "pres": [
      [
       "botella",
       2930
      ],
      [
       "media",
       1365
      ],
      [
       "trago",
       142
      ]
     ]
    }
   ],
   "sinBebidas": true
  },
  "destilados": {
   "icono": "shot",
   "nombre": {
    "es": "Tequila y vodka"
   },
   "resumen": {
    "es": "Por trago o botella"
   },
   "sug": [
    "limonada",
    "tostones"
   ],
   "platos": [
    {
     "id": "tequila-oro",
     "n": {
      "es": "Tequila oro"
     },
     "pres": [
      [
       "botella",
       1465
      ],
      [
       "trago",
       110
      ]
     ]
    },
    {
     "id": "tequila-blanco",
     "n": {
      "es": "Tequila blanco"
     },
     "pres": [
      [
       "botella",
       1465
      ],
      [
       "trago",
       110
      ]
     ]
    },
    {
     "id": "finlandia",
     "n": {
      "es": "Vodka Finlandia"
     },
     "pres": [
      [
       "botella",
       2051
      ],
      [
       "media",
       1044
      ],
      [
       "trago",
       114
      ]
     ],
     "sug": [
      "jugo-naranja",
      "gaseosa@0"
     ]
    }
   ],
   "sinBebidas": true
  }
 },
 "momentos": {
  "desayuno": {
   "icono": "sol",
   "grupos": [
    {
     "n": {
      "es": "Desayunos"
     },
     "cats": [
      "des-tipicos",
      "des-dulces"
     ]
    },
    {
     "n": {
      "es": "Complementos y bebidas"
     },
     "cats": [
      "des-extras",
      "calientes",
      "frias"
     ]
    }
   ]
  },
  "almuerzo": {
   "icono": "plato",
   "grupos": [
    {
     "n": {
      "es": "Platos fuertes"
     },
     "nota": {
      "es": "Los platos fuertes incluyen ensalada, arroz y papas, excepto la pasta con camarones."
     },
     "cats": [
      "carnes",
      "mariscos",
      "aves"
     ]
    },
    {
     "n": {
      "es": "Para empezar"
     },
     "cats": [
      "entradas",
      "sopas",
      "ensaladas"
     ]
    },
    {
     "n": {
      "es": "Algo rápido"
     },
     "cats": [
      "sandwiches",
      "ninos"
     ]
    },
    {
     "n": {
      "es": "Postres y bebidas"
     },
     "cats": [
      "postres",
      "frias",
      "calientes"
     ]
    }
   ]
  },
  "bar": {
   "icono": "copa",
   "grupos": [
    {
     "n": {
      "es": "Cócteles"
     },
     "cats": [
      "cocteles",
      "frutales"
     ]
    },
    {
     "n": {
      "es": "Cerveza y vino"
     },
     "cats": [
      "cervezas",
      "vinos"
     ]
    },
    {
     "n": {
      "es": "Licores"
     },
     "cats": [
      "ron",
      "whisky",
      "destilados"
     ]
    }
   ]
  }
 }
};
