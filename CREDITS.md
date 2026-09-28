# Creditos y atribuciones

Las 110 cartas de `data/players.json` usan una fotografia real de cada jugador,
descargada de Wikimedia Commons. Las tablas de abajo son la atribucion que
exigen las licencias: sin este fichero el repositorio incumple los terminos de
las imagenes que contiene.

El listado legible se genera desde `data/attributions.json`, que es la fuente
de verdad y la que valida `pnpm dataset:check`. Si cambia una foto, actualiza el
JSON y regenera este fichero; no lo edites a mano:

```powershell
node tools/build-credits.cjs .
```

## Que se hace con cada imagen

De cada original se generan dos ficheros, ambos en `data/`:

- `photos/`: la fotografia original, reescalada por `sharp`.
- `silhouettes/`: la misma imagen con el fondo eliminado por
  `@imgly/background-removal-node` (ONNX, en local, sin API externa) y reescalada.

Las dos son obras derivadas del original, asi que las licencias Copyleft
(CC BY-SA) siguen obligando: quien reutilice estas imagenes debe mantener la
atribucion y compartir con la misma licencia. Por eso las imagenes y el codigo
no se mezclan bajo un unico LICENSE: `data/` tiene su propio regimen, este
fichero lo declara, y el LICENSE del repo aplica al codigo.

## Licencias

| Licencia | Imagenes |
|---|---|
| CC BY-SA 3.0 | 44 |
| CC BY 2.0 | 21 |
| CC BY-SA 4.0 | 18 |
| CC BY 4.0 | 7 |
| CC BY 3.0 | 5 |
| CC BY-SA 3.0 AT | 4 |
| CC BY-SA 2.0 | 3 |
| CC BY 3.0 BR | 2 |
| Public domain | 1 |
| CC BY-SA 3.0 NL | 1 |
| CC0 | 1 |
| CC BY-SA 1.0 | 1 |
| CC BY-SA 2.0 DE | 1 |
| CC BY 3.0 br | 1 |
| **Total** | **110** |

`Public domain` y `CC0` no exigen atribucion, pero se listan igual para dejar
constancia de su procedencia.

## Detalle por imagen

### CC BY-SA 3.0

| Fichero | Autor | Fuente |
|---|---|---|
| `alaba-2014` | Harald Bischoff | [Commons](https://commons.wikimedia.org/wiki/File:David_Alaba_9486.jpg) |
| `ashley-cole-2005` | Stanislav Vedmid | [Commons](https://commons.wikimedia.org/wiki/File:ACole.JPG) |
| `beckenbauer-1974` | Mittelstädt, Rainer | [Commons](https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_183-N0622-0035,_Fu%C3%9Fball-Weltmeisterschaft,_Spiel_DDR-BRD_kaiser.jpg) |
| `beckham-2002` | Calebrw (talk) at en.wikipedia | [Commons](https://commons.wikimedia.org/wiki/File:David_Beckham_Nov_11_2007.jpg) |
| `cafu-2002` | Александр Мельников | [Commons](https://commons.wikimedia.org/wiki/File:Marcos_Evangelista_de_Moraes.jpg) |
| `cafu-2006` | Florian K | [Commons](https://commons.wikimedia.org/wiki/File:Cafu.JPG) |
| `cech-2005` | Honza Groh (Jagro) | [Commons](https://commons.wikimedia.org/wiki/File:Petr_%C4%8Cech,_Strahov.jpg) |
| `drogba-2010` | Ultraslansi | [Commons](https://commons.wikimedia.org/wiki/File:Didier_Drogba_(GS).JPG) |
| `figo-2000` | Arie R. | [Commons](https://commons.wikimedia.org/wiki/File:Luis_Figo.jpg) |
| `gerrard-2006` | Christophe95 | [Commons](https://commons.wikimedia.org/wiki/File:Steven_Gerrard_2006.jpg) |
| `gerrard-2015` | Эдгар Брещанов | [Commons](https://commons.wikimedia.org/wiki/File:Steven_Gerrard_2018.jpg) |
| `giggs-1999` | Дмитрий Голубович | [Commons](https://commons.wikimedia.org/wiki/File:Ryan_Giggs_2015_(cropped).jpg) |
| `henry-2004` | Ed g2s | [Commons](https://commons.wikimedia.org/wiki/File:Thierry_Henry.jpg) |
| `henry-2011` | Shay | [Commons](https://commons.wikimedia.org/wiki/File:Thierry_Henry_2008.jpg) |
| `iniesta-2012` | Кирилл Венедиктов | [Commons](https://commons.wikimedia.org/wiki/File:Andr%C3%A9s_Iniesta_(cropped).jpg) |
| `kahn-2001` | Schwarzwälder | [Commons](https://commons.wikimedia.org/wiki/File:Oliver_Kahn_06-2004.jpg) |
| `kaka-2007` | Евгений Асмолов | [Commons](https://commons.wikimedia.org/wiki/File:Kak%C3%A1_visited_Stadium_St._Petersburg.jpg) |
| `kroos-2018` | Steindy (talk) 19:29, 27 June 2011 (UTC) | [Commons](https://commons.wikimedia.org/wiki/File:Toni_Kroos,_Germany_national_football_team_(01).jpg) |
| `lahm-2014` | Steindy (talk) 19:14, 27 June 2011 (UTC) | [Commons](https://commons.wikimedia.org/wiki/File:Philipp_Lahm,_Germany_national_football_team_(06).jpg) |
| `lewandowski-2020` | Rufus46 | [Commons](https://commons.wikimedia.org/wiki/File:Robert_Lewandowski_Training_2017-03_FC_Bayern_Muenchen-3.jpg) |
| `makelele-2004` | Liondartois | [Commons](https://commons.wikimedia.org/wiki/File:Claude_Makelele,_staff_PSG.JPG) |
| `maldini-2003` | Christophe95 | [Commons](https://commons.wikimedia.org/wiki/File:Paolo_Maldini_2009.jpg) |
| `marquez-2006` | F. Vera | [Commons](https://commons.wikimedia.org/wiki/File:RafaelMarquezAlvarez.jpg) |
| `messi-2015` | Кирилл Венедиктов | [Commons](https://commons.wikimedia.org/wiki/File:Lionel_Messi_in_2018.jpg) |
| `modric-2018` | Антон Зайцев | [Commons](https://commons.wikimedia.org/wiki/File:Luka_Modric_2018.png) |
| `nesta-2003` | Roberto Vicario | [Commons](https://commons.wikimedia.org/wiki/File:Alessandro_Nesta_06052007.jpg) |
| `oblak-2020` | Анна Нэсси | [Commons](https://commons.wikimedia.org/wiki/File:Jan_Oblak_2019.jpg) |
| `pirlo-2006` | Bltracy | [Commons](https://commons.wikimedia.org/wiki/File:Andrea_Pirlo_in_Juventus.jpg) |
| `pirlo-2015` | Clément Bucco-Lechat | [Commons](https://commons.wikimedia.org/wiki/File:20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Andrea_Pirlo_(cropped).jpg) |
| `ribery-2013` | Rufus46 | [Commons](https://commons.wikimedia.org/wiki/File:Franck_Ribery_Training_2017-03_FC_Bayern_Muenchen-1.jpg) |
| `robben-2013` | Богдан Заяц | [Commons](https://commons.wikimedia.org/wiki/File:Arjen_Robben_v_Shakhtar_2015_(cropped).jpg) |
| `robben-2018` | Rufus46 | [Commons](https://commons.wikimedia.org/wiki/File:Arjen_Robben_Training_2018-05-08_FC_Bayern_Muenchen-5.jpg) |
| `roberto-carlos-2002` | Florian K | [Commons](https://commons.wikimedia.org/wiki/File:Roberto_Carlos.JPG) |
| `roberto-carlos-2007` | Александр Мельников | [Commons](https://commons.wikimedia.org/wiki/File:Roberto_Carlos_in_Moscow.jpg) |
| `robertson-2019` | Анна Джалалян | [Commons](https://commons.wikimedia.org/wiki/File:Andrew_Robertson_2019.jpg) |
| `ronaldo-nazario-1997` | Дмитрий Садовников | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldo_Naz%C3%A1rio.jpg) |
| `salah-2017` | Дмитрий Голубович | [Commons](https://commons.wikimedia.org/wiki/File:Mohamed_Salah_2017.jpg) |
| `theo-hernandez-2021` | Антон Зайцев | [Commons](https://commons.wikimedia.org/wiki/File:Theo_Hern%C3%A1ndez.jpg) |
| `varane-2018` | Антон Зайцев | [Commons](https://commons.wikimedia.org/wiki/File:Rapha%C3%ABl_Varane_2018.jpg) |
| `walter-samuel-2010` | Steindy | [Commons](https://commons.wikimedia.org/wiki/File:Walter_Samuel_-_Inter_Mailand_(2).jpg) |
| `walter-samuel-2015` | Steindy | [Commons](https://commons.wikimedia.org/wiki/File:Walter_Samuel_-_Inter_Mailand_(1).jpg) |
| `xavi-2014` | Fanny Schertzer | [Commons](https://commons.wikimedia.org/wiki/File:Xavier_Hern%C3%A1ndez_-_Spain_vs._Chile,_10th_September_2013.jpg) |
| `yaya-toure-2018` | Илья Хохлов | [Commons](https://commons.wikimedia.org/wiki/File:Yaya_Tour%C3%A9.JPG) |
| `zanetti-2010` | Steindy | [Commons](https://commons.wikimedia.org/wiki/File:Javier_Zanetti_-_Inter_Mailand_(1).jpg) |

### CC BY 2.0

| Fichero | Autor | Fuente |
|---|---|---|
| `bale-2014` | Pablo Morquecho | [Commons](https://commons.wikimedia.org/wiki/File:Gareth_Bale_RM.jpg) |
| `buffon-2003` | James Adams | [Commons](https://commons.wikimedia.org/wiki/File:Gian_Luigi_Buffon_2008.jpg) |
| `cannavaro-2006` | David Ruddell | [Commons](https://commons.wikimedia.org/wiki/File:Fabio_Cannavaro_in_world_cup_2006.jpg) |
| `cannavaro-2010` | Doha Stadium Plus Qatar | [Commons](https://commons.wikimedia.org/wiki/File:Fabio_Cannavaro_2011.jpg) |
| `casillas-2016` | Thomas Rodenbücher | [Commons](https://commons.wikimedia.org/wiki/File:Iker_Casillas_2015-07.jpg) |
| `dani-alves-2015` | Ronnie Macdonald from Chelmsford and Largs, United Kingdom | [Commons](https://commons.wikimedia.org/wiki/File:Dani_Alves_-_2011_-_Scotland_v_Brazil.jpg) |
| `drogba-2015` | Roscoe Myrick | [Commons](https://commons.wikimedia.org/wiki/File:DidierDrogbaMLS2015.jpg) |
| `essien-2007` | Mark Freeman | [Commons](https://commons.wikimedia.org/wiki/File:Essiencropped.jpg) |
| `evra-2010` | Ramsey Cardy / Web Summit / Sportsfile | [Commons](https://commons.wikimedia.org/wiki/File:Patrice_Evra_(52472689279)_(cropped).jpg) |
| `hazard-2015` | wonker | [Commons](https://commons.wikimedia.org/wiki/File:Eden_Hazard_2012.jpg) |
| `ibrahimovic-2013` | Ricardo Alvarez | [Commons](https://commons.wikimedia.org/wiki/File:Zlatan_Ibrahimovic_(cropped).jpg) |
| `jordi-alba-2015` | CarlosRM | [Commons](https://commons.wikimedia.org/wiki/File:Jordi_Alba.jpg) |
| `lampard-2005` | Marc W | [Commons](https://commons.wikimedia.org/wiki/File:Frank_Lampard_2009.jpg) |
| `mahrez-2015` | Ben Sutherland | [Commons](https://commons.wikimedia.org/wiki/File:Riyad_Mahrez.jpg) |
| `ozil-2014` | Ronnie Macdonald | [Commons](https://commons.wikimedia.org/wiki/File:Mesut_%C3%96zil_Arsenal_(2).jpg) |
| `pique-2012` | Vinod Divakaran | [Commons](https://commons.wikimedia.org/wiki/File:GerardPique.jpg) |
| `puyol-2009` | Alex Tremps | [Commons](https://commons.wikimedia.org/wiki/File:PuyolTraining.jpg) |
| `ronaldinho-2015` | Marcos Corrêa/PR | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldinho_Ga%C3%BAcho_em_junho_de_2019.jpg) |
| `trent-2019` | joshjdss | [Commons](https://commons.wikimedia.org/wiki/File:Trent_Alexander_Arnold_2016.jpg) |
| `vandijk-2019` | ShaunPG | [Commons](https://commons.wikimedia.org/wiki/File:VVD_-_2025_Liverpool_Trophy_Parade_(crop).jpg) |
| `xavi-2010` | Doha Stadium Plus Qatar from Doha, Qatar | [Commons](https://commons.wikimedia.org/wiki/File:Xavi_Hernandez_(31521652051).jpg) |

### CC BY-SA 4.0

| Fichero | Autor | Fuente |
|---|---|---|
| `buffon-2018` | Prugna | [Commons](https://commons.wikimedia.org/wiki/File:Buffon_2020_(cropped).jpg) |
| `busquets-2015` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Busquets_NE_Revolution_Inter_Miami_7.9.25-060.jpg) |
| `busquets-2023` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Busquets_NYCFC_Miami_24_Sep_2025-020_(cropped).jpg) |
| `casemiro-2018` | Julia Engel | [Commons](https://commons.wikimedia.org/wiki/File:20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Casemiro_850_1575.jpg) |
| `jordi-alba-2023` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Jordi_Alba_NE_Revolution_Inter_Miami_7.9.25-047_(cropped).jpg) |
| `kante-2018` | Liondartois | [Commons](https://commons.wikimedia.org/wiki/File:N%27Golo_Kant%C3%A9_(Chelsea).jpg) |
| `modric-2025` | Bryan Berlin / WikiPortraits | [Commons](https://commons.wikimedia.org/wiki/File:Luka_Modric_Croatia_v_Portugal_2_July_2026-025.jpg) |
| `neuer-2014` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Manuel_Neuer_Ecuador_v_Germany_25_June_2026-025.jpg) |
| `ribery-2021` | Sven Mandel | [Commons](https://commons.wikimedia.org/wiki/File:Franck_Ribery_2019_(cropped).jpg) |
| `rio-ferdinand-2008` | Walterlan Papetti | [Commons](https://commons.wikimedia.org/wiki/File:Rio_Ferdinand_by_Walterlan_Papetti.jpg) |
| `rivaldo-2008` | Nursultan12 | [Commons](https://commons.wikimedia.org/wiki/File:Rivaldo_bunyodkor_2010.jpg) |
| `sergio-ramos-2018` | Ruben Ortega | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Ramos_entrenando_(cropped).jpg) |
| `stoichkov-1994` | Biser Todorov | [Commons](https://commons.wikimedia.org/wiki/File:Hristo_Stoichkov_50_Years_%E2%84%96_8.jpg) |
| `trent-2025` | Dudek1337 | [Commons](https://commons.wikimedia.org/wiki/File:Trent_Alexander_Arnold_2022_(2)_(cropped).jpg) |
| `varane-2023` | Ardfern | [Commons](https://commons.wikimedia.org/wiki/File:Rapha%C3%ABl_Varane_2022.jpg) |
| `vieira-2001` | Simon Heseltine | [Commons](https://commons.wikimedia.org/wiki/File:Patrick_Vieira_NYCFC.JPG) |
| `walker-2019` | Steffen Prößdorf (crop: Mattythewhite) | [Commons](https://commons.wikimedia.org/wiki/File:Kyle_Walker_2021-12-07_1.jpg) |
| `zidane-2000` | Walterlan Papetti | [Commons](https://commons.wikimedia.org/wiki/File:Zidane_Zizu.jpg) |

### CC BY 4.0

| Fichero | Autor | Fuente |
|---|---|---|
| `cech-2018` | Amir Hosseini / Fars Media Corporation | [Commons](https://commons.wikimedia.org/wiki/File:Arsenal_players_training_before_2019_UEFA_Europa_League_final_07_(cropped).jpg) |
| `cristiano-2023` | Tasnim News Agency (Mohammad Hossein Movahedi Nejad) | [Commons](https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_Al-Nassr_2023.jpg) |
| `figo-2008` | Biser Todorov | [Commons](https://commons.wikimedia.org/wiki/File:L._Figo_2017_(cropped).jpg) |
| `marcelo-2017` | Tasnim News Agency (Hadi Abyar) | [Commons](https://commons.wikimedia.org/wiki/File:Al_Jazira_Club_v_Real_Madrid_CF,_13_December_2017_-_05.jpg) |
| `messi-2023` | Hayden Schiff | [Commons](https://commons.wikimedia.org/wiki/File:CINvMIA_2023-08-23_-_Lionel_Messi,_Tata_Martino_(PXL_20230824_010525464)_(Messi_crop).jpg) |
| `neymar-2023` | Tasnim News Agency (Meghdad Madadi) | [Commons](https://commons.wikimedia.org/wiki/File:Neymar_Jr._with_Al_Hilal,_3_October_2023_-_08.jpg) |
| `thiago-silva-2023` | Fars Media Corporation (Mohammad Amin Ansari) | [Commons](https://commons.wikimedia.org/wiki/File:Thiago_Silva_with_Club_World_Cup_Trophy_2022.jpg) |

### CC BY 3.0

| Fichero | Autor | Fuente |
|---|---|---|
| `casillas-2010` | Elemaki | [Commons](https://commons.wikimedia.org/wiki/File:IkerCasillas.JPG) |
| `hazard-2021` | Real Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Eden_Hazard_Real_Madrid.jpg) |
| `ramos-2022` | Real Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Ramos_Interview_2021_(cropped).jpg) |
| `riquelme-2006` | Todo Noticias | [Commons](https://commons.wikimedia.org/wiki/File:Juan_Rom%C3%A1n_Riquelme_-_2019.jpg) |
| `schmeichel-1998` | Carlsberg Group | [Commons](https://commons.wikimedia.org/wiki/File:Peter_Schmeichel_2012-01-03_001.jpg) |

### CC BY-SA 3.0 AT

| Fichero | Autor | Fuente |
|---|---|---|
| `fernandinho-2017` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:20141118_AUTBRA_5044.jpg) |
| `neymar-2015` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:20141118_AUTBRA_5089.jpg) |
| `thiago-silva-2013` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:20141118_1838_AUTBRA_4935.jpg) |
| `yaya-toure-2014` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:Yaya_Toure_9229.JPG) |

### CC BY-SA 2.0

| Fichero | Autor | Fuente |
|---|---|---|
| `cristiano-2008` | goatling (Flickr) | [Commons](https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo,_2012_2.JPG) |
| `iniesta-2018` | Tam Tam | [Commons](https://commons.wikimedia.org/wiki/File:Andres_Iniesta_2018_(edited)_(cropped).jpg) |
| `walker-2025` | Patryk Antkiewicz | [Commons](https://commons.wikimedia.org/wiki/File:Kyle-Walker-2023.jpg) |

### CC BY 3.0 BR

| Fichero | Autor | Fuente |
|---|---|---|
| `dani-alves-2021` | Rede do Esporte (Breno Barros) | [Commons](https://commons.wikimedia.org/wiki/File:Dani_Alves_nos_Juegos_Olimpicos.jpg) |
| `rivaldo-1999` | Laura Cortizo/Portal da Copa | [Commons](https://commons.wikimedia.org/wiki/File:Rivaldo_(full_version).jpg) |

### Public domain

| Fichero | Autor | Fuente |
|---|---|---|
| `beckenbauer-1977` | Panini Group | [Commons](https://commons.wikimedia.org/wiki/File:Franz_Beckenbauer_(1975).jpg) |

### CC BY-SA 3.0 NL

| Fichero | Autor | Fuente |
|---|---|---|
| `cruyff-1974` | Bert Verhoeff / Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Johan_Cruyff_1971c.jpg) |

### CC0

| Fichero | Autor | Fuente |
|---|---|---|
| `cruyff-1979` | Koen Suyk / Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Cruijff_afscheidswedstrijd_bij_Ajax.jpg) |

### CC BY-SA 1.0

| Fichero | Autor | Fuente |
|---|---|---|
| `maldini-2007` | Yelena Rybakova | [Commons](https://commons.wikimedia.org/wiki/File:Maldini2008.JPG) |

### CC BY-SA 2.0 DE

| Fichero | Autor | Fuente |
|---|---|---|
| `ronaldinho-2006` | Reto Stauffer | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldinho061115.jpg) |

### CC BY 3.0 br

| Fichero | Autor | Fuente |
|---|---|---|
| `ronaldo-nazario-2009` | Ricardo Stuckert / Agência Brasil | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldo2009Corinthians.jpg) |

