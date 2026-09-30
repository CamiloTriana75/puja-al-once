# Creditos y atribuciones

Las 149 cartas de `data/players.json` usan una fotografia real de cada jugador,
descargada de Wikimedia Commons. Las tablas de abajo son la atribucion que
exigen las licencias: sin este fichero el repositorio incumple los terminos de
las imagenes que contiene.

El listado legible se genera desde `data/attributions.json`, que es la fuente
de verdad y la que valida `pnpm dataset:check`. Si cambia una foto, actualiza el
JSON y regenera este fichero; no lo edites a mano:

```powershell
node tools/build-credits.cjs .
```

Ese mismo generador emite la pagina publica de creditos en
`packages/client/public/legal/creditos.html`, que es la atribucion que ven los
jugadores (enlazada desde el pie de la portada).

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
| CC BY-SA 3.0 | 52 |
| CC BY 2.0 | 21 |
| CC BY-SA 4.0 | 19 |
| Public domain | 10 |
| CC BY 4.0 | 9 |
| CC BY 3.0 | 8 |
| CC0 | 7 |
| CC BY-SA 2.0 | 6 |
| CC BY-SA 3.0 nl | 4 |
| CC BY-SA 3.0 AT | 4 |
| CC BY 3.0 br | 2 |
| CC BY-SA 3.0 NL | 1 |
| Attribution | 1 |
| CC BY-SA 3.0 at | 1 |
| CC BY-SA 1.0 | 1 |
| CC BY 3.0 BR | 1 |
| CC BY-SA 2.0 DE | 1 |
| CC BY 2.5 | 1 |
| **Total** | **149** |

`Public domain` y `CC0` no exigen atribucion, pero se listan igual para dejar
constancia de su procedencia.

## Detalle por imagen

### CC BY-SA 3.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| David Alaba (2014) | `alaba-2014` | Harald Bischoff | [Commons](https://commons.wikimedia.org/wiki/File:David_Alaba_9486.jpg) |
| Ashley Cole (2005) | `ashley-cole-2005` | Stanislav Vedmid | [Commons](https://commons.wikimedia.org/wiki/File:ACole.JPG) |
| Franz Beckenbauer (1974) | `beckenbauer-1974` | Mittelstädt, Rainer | [Commons](https://commons.wikimedia.org/wiki/File:Bundesarchiv_Bild_183-N0622-0035,_Fu%C3%9Fball-Weltmeisterschaft,_Spiel_DDR-BRD_kaiser.jpg) |
| David Beckham (2002) | `beckham-2002` | Calebrw (talk) at en.wikipedia | [Commons](https://commons.wikimedia.org/wiki/File:David_Beckham_Nov_11_2007.jpg) |
| Giuseppe Bergomi (1982) | `bergomi-1982` | Christophe95 | [Commons](https://commons.wikimedia.org/wiki/File:Giuseppe_Bergomi.jpg) |
| Cafu (2002) | `cafu-2002` | Александр Мельников | [Commons](https://commons.wikimedia.org/wiki/File:Marcos_Evangelista_de_Moraes.jpg) |
| Cafu (2006) | `cafu-2006` | Florian K | [Commons](https://commons.wikimedia.org/wiki/File:Cafu.JPG) |
| Petr Cech (2005) | `cech-2005` | Honza Groh (Jagro) | [Commons](https://commons.wikimedia.org/wiki/File:Petr_%C4%8Cech,_Strahov.jpg) |
| Kevin De Bruyne (2020) | `de-bruyne-2020` | Светлана Бекетова | [Commons](https://commons.wikimedia.org/wiki/File:Kevin_De_Bruyne.jpg) |
| Dida (2005) | `dida-2005` | Roberto Vicario | [Commons](https://commons.wikimedia.org/wiki/File:Dida_06052007.jpg) |
| Didier Drogba (2010) | `drogba-2010` | Ultraslansi | [Commons](https://commons.wikimedia.org/wiki/File:Didier_Drogba_(GS).JPG) |
| Luis Figo (2000) | `figo-2000` | Arie R. | [Commons](https://commons.wikimedia.org/wiki/File:Luis_Figo.jpg) |
| Steven Gerrard (2006) | `gerrard-2006` | Christophe95 | [Commons](https://commons.wikimedia.org/wiki/File:Steven_Gerrard_2006.jpg) |
| Steven Gerrard (2015) | `gerrard-2015` | Эдгар Брещанов | [Commons](https://commons.wikimedia.org/wiki/File:Steven_Gerrard_2018.jpg) |
| Ryan Giggs (1999) | `giggs-1999` | Дмитрий Голубович | [Commons](https://commons.wikimedia.org/wiki/File:Ryan_Giggs_2015_(cropped).jpg) |
| Gheorghe Hagi (1994) | `hagi-1994` | Gabinho | [Commons](https://commons.wikimedia.org/wiki/File:Gheorghe_Hagi_at_the_2012_BRD_N%C4%83stase_%C8%9Airiac_Trophy.jpg) |
| Thierry Henry (2004) | `henry-2004` | Ed g2s | [Commons](https://commons.wikimedia.org/wiki/File:Thierry_Henry.jpg) |
| Thierry Henry (2011) | `henry-2011` | Shay | [Commons](https://commons.wikimedia.org/wiki/File:Thierry_Henry_2008.jpg) |
| Andres Iniesta (2012) | `iniesta-2012` | Castroquini | [Commons](https://commons.wikimedia.org/wiki/File:2012_2013_-_08_Andr%C3%A9s_Iniesta.jpg) |
| Oliver Kahn (2001) | `kahn-2001` | Schwarzwälder | [Commons](https://commons.wikimedia.org/wiki/File:Oliver_Kahn_06-2004.jpg) |
| Kaka (2007) | `kaka-2007` | Евгений Асмолов | [Commons](https://commons.wikimedia.org/wiki/File:Kak%C3%A1_visited_Stadium_St._Petersburg.jpg) |
| Philipp Lahm (2014) | `lahm-2014` | Steindy (talk) 19:14, 27 June 2011 (UTC) | [Commons](https://commons.wikimedia.org/wiki/File:Philipp_Lahm,_Germany_national_football_team_(06).jpg) |
| Robert Lewandowski (2020) | `lewandowski-2020` | Rufus46 | [Commons](https://commons.wikimedia.org/wiki/File:Robert_Lewandowski_Training_2017-03_FC_Bayern_Muenchen-3.jpg) |
| Maicon (2010) | `maicon-2010` | Steindy ( talk ) 23:39, 28 November 2009 (UTC) | [Commons](https://commons.wikimedia.org/wiki/File:Maicon_Douglas_Sisenando_-_Inter_Mailand_(2).jpg) |
| Claude Makelele (2004) | `makelele-2004` | Liondartois | [Commons](https://commons.wikimedia.org/wiki/File:Claude_Makelele,_staff_PSG.JPG) |
| Paolo Maldini (2003) | `maldini-2003` | Christophe95 | [Commons](https://commons.wikimedia.org/wiki/File:Paolo_Maldini_2009.jpg) |
| Sadio Mane (2019) | `mane-2019` | Екатерина Лаут | [Commons](https://commons.wikimedia.org/wiki/File:Sadio_Man%C3%A9_Senegal.jpg) |
| Rafael Marquez (2006) | `marquez-2006` | F. Vera | [Commons](https://commons.wikimedia.org/wiki/File:RafaelMarquezAlvarez.jpg) |
| Javier Mascherano (2014) | `mascherano-2014` | Ludovic Péron | [Commons](https://commons.wikimedia.org/wiki/File:Javier_Mascherano_-_2011.jpg) |
| Lothar Matthaus (1990) | `matthaus-1990` | Florian K. | [Commons](https://commons.wikimedia.org/wiki/File:Lothar_Matth%C3%A4us.jpg) |
| Luka Modric (2018) | `modric-2018` | Антон Зайцев | [Commons](https://commons.wikimedia.org/wiki/File:Luka_Modric_2018.png) |
| Alessandro Nesta (2003) | `nesta-2003` | Roberto Vicario | [Commons](https://commons.wikimedia.org/wiki/File:Alessandro_Nesta_06052007.jpg) |
| Jan Oblak (2020) | `oblak-2020` | Анна Нэсси | [Commons](https://commons.wikimedia.org/wiki/File:Jan_Oblak_2019.jpg) |
| Andrea Pirlo (2006) | `pirlo-2006` | Bltracy | [Commons](https://commons.wikimedia.org/wiki/File:Andrea_Pirlo_in_Juventus.jpg) |
| Andrea Pirlo (2015) | `pirlo-2015` | Clément Bucco-Lechat | [Commons](https://commons.wikimedia.org/wiki/File:20150616_-_Portugal_-_Italie_-_Gen%C3%A8ve_-_Andrea_Pirlo_(cropped).jpg) |
| Franck Ribery (2013) | `ribery-2013` | Rufus46 | [Commons](https://commons.wikimedia.org/wiki/File:Franck_Ribery_Training_2017-03_FC_Bayern_Muenchen-1.jpg) |
| Arjen Robben (2013) | `robben-2013` | Богдан Заяц | [Commons](https://commons.wikimedia.org/wiki/File:Arjen_Robben_v_Shakhtar_2015_(cropped).jpg) |
| Arjen Robben (2018) | `robben-2018` | Rufus46 | [Commons](https://commons.wikimedia.org/wiki/File:Arjen_Robben_Training_2018-05-08_FC_Bayern_Muenchen-5.jpg) |
| Roberto Carlos (2002) | `roberto-carlos-2002` | Florian K | [Commons](https://commons.wikimedia.org/wiki/File:Roberto_Carlos.JPG) |
| Roberto Carlos (2007) | `roberto-carlos-2007` | Мельников Александр | [Commons](https://commons.wikimedia.org/wiki/File:Roberto_Carlos_in_Moscow_3_(cropped).jpg) |
| Andrew Robertson (2019) | `robertson-2019` | Анна Джалалян | [Commons](https://commons.wikimedia.org/wiki/File:Andrew_Robertson_2019.jpg) |
| Ronaldo Nazario (1997) | `ronaldo-nazario-1997` | Дмитрий Садовников | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldo_Naz%C3%A1rio.jpg) |
| Mohamed Salah (2017) | `salah-2017` | Дмитрий Голубович | [Commons](https://commons.wikimedia.org/wiki/File:Mohamed_Salah_2017.jpg) |
| Clarence Seedorf (2003) | `seedorf-2003` | Кирилл Венедиктов | [Commons](https://commons.wikimedia.org/wiki/File:Clarence_Seedorf_2021.jpg) |
| Hristo Stoichkov (1994) | `stoichkov-1994` | Litexfan | [Commons](https://commons.wikimedia.org/wiki/File:Hristo_Stoichkov_FC_Litex_Lovech_manager.JPG) |
| Theo Hernandez (2021) | `theo-hernandez-2021` | Антон Зайцев | [Commons](https://commons.wikimedia.org/wiki/File:Theo_Hern%C3%A1ndez.jpg) |
| Raphael Varane (2018) | `varane-2018` | Антон Зайцев | [Commons](https://commons.wikimedia.org/wiki/File:Rapha%C3%ABl_Varane_2018.jpg) |
| Walter Samuel (2010) | `walter-samuel-2010` | Steindy ( talk ) 17:05, 29 November 2009 (UTC) | [Commons](https://commons.wikimedia.org/wiki/File:Walter_Samuel_-_Inter_Mailand_(1).jpg) |
| Walter Samuel (2015) | `walter-samuel-2015` | Steindy | [Commons](https://commons.wikimedia.org/wiki/File:Walter_Samuel_-_Inter_Mailand_(1).jpg) |
| Xavi Hernandez (2010) | `xavi-2010` | Steindy ( talk ) 13:11, 13 July 2010 (UTC) | [Commons](https://commons.wikimedia.org/wiki/File:Xavi_Hern%C3%A1ndez_Spain_2009_(cropped).jpg) |
| Xavi Hernandez (2014) | `xavi-2014` | Fanny Schertzer | [Commons](https://commons.wikimedia.org/wiki/File:Xavier_Hern%C3%A1ndez_-_Spain_vs._Chile,_10th_September_2013.jpg) |
| Javier Zanetti (2010) | `zanetti-2010` | Steindy | [Commons](https://commons.wikimedia.org/wiki/File:Javier_Zanetti_-_Inter_Mailand_(1).jpg) |

### CC BY 2.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Gareth Bale (2014) | `bale-2014` | Pablo Morquecho | [Commons](https://commons.wikimedia.org/wiki/File:Gareth_Bale_RM.jpg) |
| Karim Benzema (2022) | `benzema-2022` | Fotografías Archimadrid.es | [Commons](https://commons.wikimedia.org/wiki/File:Karim_Benzema_2022_(cropped).jpg) |
| Fabio Cannavaro (2006) | `cannavaro-2006` | David Ruddell | [Commons](https://commons.wikimedia.org/wiki/File:Fabio_Cannavaro_in_world_cup_2006.jpg) |
| Fabio Cannavaro (2010) | `cannavaro-2010` | Doha Stadium Plus Qatar | [Commons](https://commons.wikimedia.org/wiki/File:Fabio_Cannavaro_2011.jpg) |
| Iker Casillas (2016) | `casillas-2016` | Thomas Rodenbücher | [Commons](https://commons.wikimedia.org/wiki/File:Iker_Casillas_2015-07.jpg) |
| Cristiano Ronaldo (2008) | `cristiano-2008` | Photo beople/gowestphoto/ Tsutomu Takasu] | [Commons](https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_of_Manchester_United,_November_5,_2008.jpg) |
| Dani Alves (2015) | `dani-alves-2015` | Ronnie Macdonald from Chelmsford and Largs, United Kingdom | [Commons](https://commons.wikimedia.org/wiki/File:Dani_Alves_-_2011_-_Scotland_v_Brazil.jpg) |
| Didier Drogba (2015) | `drogba-2015` | Roscoe Myrick | [Commons](https://commons.wikimedia.org/wiki/File:DidierDrogbaMLS2015.jpg) |
| Patrice Evra (2010) | `evra-2010` | Ramsey Cardy / Web Summit / Sportsfile | [Commons](https://commons.wikimedia.org/wiki/File:Patrice_Evra_(52472689279)_(cropped).jpg) |
| Eden Hazard (2015) | `hazard-2015` | wonker | [Commons](https://commons.wikimedia.org/wiki/File:Eden_Hazard_2012.jpg) |
| Zlatan Ibrahimovic (2013) | `ibrahimovic-2013` | Ricardo Alvarez | [Commons](https://commons.wikimedia.org/wiki/File:Zlatan_Ibrahimovic_(cropped).jpg) |
| Roy Keane (1999) | `keane-1999` | Irish Defence Forces from Ireland | [Commons](https://commons.wikimedia.org/wiki/File:Roy_keane_2014.jpg) |
| Frank Lampard (2005) | `lampard-2005` | Marc W | [Commons](https://commons.wikimedia.org/wiki/File:Frank_Lampard_2009.jpg) |
| Riyad Mahrez (2015) | `mahrez-2015` | Ben Sutherland | [Commons](https://commons.wikimedia.org/wiki/File:Riyad_Mahrez.jpg) |
| Mesut Ozil (2014) | `ozil-2014` | Ronnie Macdonald | [Commons](https://commons.wikimedia.org/wiki/File:Mesut_%C3%96zil_Arsenal_(2).jpg) |
| Gerard Pique (2012) | `pique-2012` | Vinod Divakaran | [Commons](https://commons.wikimedia.org/wiki/File:GerardPique.jpg) |
| Michel Platini (1984) | `platini-1984` | Klearchos Kapoutsis from Paleo Faliro, Greece | [Commons](https://commons.wikimedia.org/wiki/File:Michel_Platini_in_Wroclaw_by_Klearchos_Kapoutsis_tight_crop.jpg) |
| Carles Puyol (2009) | `puyol-2009` | Alex Tremps | [Commons](https://commons.wikimedia.org/wiki/File:PuyolTraining.jpg) |
| Ronaldinho (2015) | `ronaldinho-2015` | Marcos Corrêa/PR | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldinho_Ga%C3%BAcho_em_junho_de_2019.jpg) |
| Trent Alexander-Arnold (2019) | `trent-2019` | Eric The Fish from UK | [Commons](https://commons.wikimedia.org/wiki/File:LFC_Parade_2019_01_Trent_Alexander-Arnold.jpg) |
| Nemanja Vidic (2011) | `vidic-2011` | Austin Osuide | [Commons](https://commons.wikimedia.org/wiki/File:Nemanja_Vidi%C4%87_(cropped).jpg) |

### CC BY-SA 4.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Gianluigi Buffon (2018) | `buffon-2018` | Prugna | [Commons](https://commons.wikimedia.org/wiki/File:Buffon_2020_(cropped).jpg) |
| Sergio Busquets (2015) | `busquets-2015` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Busquets_NE_Revolution_Inter_Miami_7.9.25-028.jpg) |
| Sergio Busquets (2023) | `busquets-2023` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Busquets_NYCFC_Miami_24_Sep_2025-020_(cropped).jpg) |
| Joao Cancelo (2021) | `cancelo-2021` | Ardfern | [Commons](https://commons.wikimedia.org/wiki/File:Joao_Cancelo_2021.jpg) |
| Casemiro (2018) | `casemiro-2018` | Julia Engel | [Commons](https://commons.wikimedia.org/wiki/File:20180610_FIFA_Friendly_Match_Austria_vs._Brazil_Casemiro_850_1575.jpg) |
| Marcel Desailly (1998) | `desailly-1998` | Barcex | [Commons](https://commons.wikimedia.org/wiki/File:25th_Laureus_World_Sports_Awards_-_Red_Carpet_-_Marcel_Desailly_-_240422_192752-3_(cropped).jpg) |
| Jordi Alba (2023) | `jordi-alba-2023` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Jordi_Alba_NE_Revolution_Inter_Miami_7.9.25-047_(cropped).jpg) |
| Luka Modric (2025) | `modric-2025` | Bryan Berlin / WikiPortraits | [Commons](https://commons.wikimedia.org/wiki/File:Luka_Modric_Croatia_v_Portugal_2_July_2026-025.jpg) |
| Keylor Navas (2016) | `navas-2016` | Ruben Ortega | [Commons](https://commons.wikimedia.org/wiki/File:Keylor_Navas_en_el_Real_Madrid_(cropped).JPG) |
| Manuel Neuer (2014) | `neuer-2014` | Bryan Berlin | [Commons](https://commons.wikimedia.org/wiki/File:Manuel_Neuer_Ecuador_v_Germany_25_June_2026-025.jpg) |
| Franck Ribery (2021) | `ribery-2021` | Sven Mandel | [Commons](https://commons.wikimedia.org/wiki/File:Franck_Ribery_2019_(cropped).jpg) |
| Rio Ferdinand (2008) | `rio-ferdinand-2008` | Walterlan Papetti | [Commons](https://commons.wikimedia.org/wiki/File:Rio_Ferdinand_by_Walterlan_Papetti.jpg) |
| Rivaldo (2008) | `rivaldo-2008` | w:User:Nursultan12 | [Commons](https://commons.wikimedia.org/wiki/File:Rivaldo_bunyodkor_2010.jpg) |
| Sergio Ramos (2018) | `sergio-ramos-2018` | Ruben Ortega | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Ramos_entrenando_(cropped).jpg) |
| Trent Alexander-Arnold (2025) | `trent-2025` | Dudek1337 | [Commons](https://commons.wikimedia.org/wiki/File:Trent_Alexander_Arnold_2022_(2)_(cropped).jpg) |
| Raphael Varane (2023) | `varane-2023` | Ardfern | [Commons](https://commons.wikimedia.org/wiki/File:Rapha%C3%ABl_Varane_2022.jpg) |
| Patrick Vieira (2001) | `vieira-2001` | Simon Heseltine | [Commons](https://commons.wikimedia.org/wiki/File:Patrick_Vieira_NYCFC.JPG) |
| Kyle Walker (2019) | `walker-2019` | Steffen Prößdorf (crop: Mattythewhite) | [Commons](https://commons.wikimedia.org/wiki/File:Kyle_Walker_2021-12-07_1.jpg) |
| Zinedine Zidane (2000) | `zidane-2000` | Walterlan Papetti | [Commons](https://commons.wikimedia.org/wiki/File:Zidane_Zizu.jpg) |

### Public domain

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Roberto Baggio (1994) | `baggio-1994` | Unknown author Unknown author | [Commons](https://commons.wikimedia.org/wiki/File:Roberto_Baggio_-_Lanerossi_Vicenza.jpg) |
| Gabriel Batistuta (1998) | `batistuta-1998` | Wikimedia Commons | [Commons](https://commons.wikimedia.org/wiki/File:Gabriel_batistuta.jpg) |
| Franz Beckenbauer (1977) | `beckenbauer-1977` | Panini Group | [Commons](https://commons.wikimedia.org/wiki/File:Franz_Beckenbauer_(1975).jpg) |
| Giacinto Facchetti (1968) | `facchetti-1968` | Unknown author Unknown author | [Commons](https://commons.wikimedia.org/wiki/File:Giacinto_Facchetti,_Italia,_Euro_%2768.jpg) |
| Garrincha (1962) | `garrincha-1962` | El Gráfico | [Commons](https://commons.wikimedia.org/wiki/File:MFdSantos-Garrincha.jpg) |
| Jairzinho (1970) | `jairzinho-1970` | Panini | [Commons](https://commons.wikimedia.org/wiki/File:Jairzinho_M%C3%A9xico_70.jpg) |
| Nilton Santos (1962) | `nilton-santos-1962` | Unknown Unknown | [Commons](https://commons.wikimedia.org/wiki/File:Nilton_Santos_2_(1956).tif) |
| Daniel Passarella (1978) | `passarella-1978` | Unknown author Unknown author | [Commons](https://commons.wikimedia.org/wiki/File:Daniel_passarella_en_1985.jpg) |
| Gaetano Scirea (1982) | `scirea-1982` | Unknown author Unknown author | [Commons](https://commons.wikimedia.org/wiki/File:1975%E2%80%9376_Juventus_FC_-_Gaetano_Scirea.jpg) |
| Lilian Thuram (1998) | `thuram-1998` | Mutari | [Commons](https://commons.wikimedia.org/wiki/File:Lilian_Thuram_-_001.jpg) |

### CC BY 4.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Petr Cech (2018) | `cech-2018` | Amir Hosseini / Fars Media Corporation | [Commons](https://commons.wikimedia.org/wiki/File:Arsenal_players_training_before_2019_UEFA_Europa_League_final_07_(cropped).jpg) |
| Cristiano Ronaldo (2023) | `cristiano-2023` | Tasnim News Agency (Mohammad Hossein Movahedi Nejad) | [Commons](https://commons.wikimedia.org/wiki/File:Cristiano_Ronaldo_Al-Nassr_2023.jpg) |
| Luis Figo (2008) | `figo-2008` | Biser Todorov | [Commons](https://commons.wikimedia.org/wiki/File:L._Figo_2017_(cropped).jpg) |
| Eden Hazard (2021) | `hazard-2021` | Hossein Zohrevand | [Commons](https://commons.wikimedia.org/wiki/File:Eden_Hazard_WC2022.jpg) |
| N'Golo Kante (2018) | `kante-2018` | Amir Hosseini | [Commons](https://commons.wikimedia.org/wiki/File:N%27Golo_Kant%C3%A9_at_Baku_before_2019_UEFA_Europe_League_Final.jpg) |
| Marcelo (2017) | `marcelo-2017` | Tasnim News Agency (Hadi Abyar) | [Commons](https://commons.wikimedia.org/wiki/File:Al_Jazira_Club_v_Real_Madrid_CF,_13_December_2017_-_05.jpg) |
| Lionel Messi (2023) | `messi-2023` | Hayden Schiff | [Commons](https://commons.wikimedia.org/wiki/File:CINvMIA_2023-08-23_-_Lionel_Messi,_Tata_Martino_(PXL_20230824_010525464)_(Messi_crop).jpg) |
| Neymar (2023) | `neymar-2023` | Tasnim News Agency (Meghdad Madadi) | [Commons](https://commons.wikimedia.org/wiki/File:Neymar_Jr._with_Al_Hilal,_3_October_2023_-_08.jpg) |
| Thiago Silva (2023) | `thiago-silva-2023` | Fars Media Corporation (Mohammad Amin Ansari) | [Commons](https://commons.wikimedia.org/wiki/File:Thiago_Silva_with_Club_World_Cup_Trophy_2022.jpg) |

### CC BY 3.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Gianluigi Buffon (2003) | `buffon-2003` | Biser Todorov (original picture), Mess (derivative work) | [Commons](https://commons.wikimedia.org/wiki/File:Gianluigi_Buffon_BGR-ITA_2012.jpg) |
| Iker Casillas (2010) | `casillas-2010` | Elemaki | [Commons](https://commons.wikimedia.org/wiki/File:IkerCasillas.JPG) |
| Cesc Fabregas (2010) | `fabregas-2010` | Harald Loos / Puma SE | [Commons](https://commons.wikimedia.org/wiki/File:Cesc_F%C3%A0bregas_2011-09-22_001.jpg) |
| Toni Kroos (2018) | `kroos-2018` | https://www.youtube.com/@realmadrid | [Commons](https://commons.wikimedia.org/wiki/File:Toni_Kroos_Real_Madrid_2021.jpg) |
| Sergio Ramos (2022) | `ramos-2022` | Real Madrid | [Commons](https://commons.wikimedia.org/wiki/File:Sergio_Ramos_Interview_2021_(cropped).jpg) |
| Juan Roman Riquelme (2006) | `riquelme-2006` | Todo Noticias | [Commons](https://commons.wikimedia.org/wiki/File:Juan_Rom%C3%A1n_Riquelme_-_2019.jpg) |
| Peter Schmeichel (1998) | `schmeichel-1998` | Carlsberg Group | [Commons](https://commons.wikimedia.org/wiki/File:Peter_Schmeichel_2012-01-03_001.jpg) |
| Yaya Toure (2018) | `yaya-toure-2018` | Puma | [Commons](https://commons.wikimedia.org/wiki/File:Yaya_Tour%C3%A9_(cropped).jpg) |

### CC0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| George Best (1968) | `best-1968` | Hans Peters for Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Nederland_tegen_Noord_Ierland_George_Best_,_kop,_Bestanddeelnr_928-8290.jpg) |
| Johan Cruyff (1979) | `cruyff-1979` | Koen Suyk / Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Cruijff_afscheidswedstrijd_bij_Ajax.jpg) |
| Eusebio (1966) | `eusebio-1966` | Harry Pot for Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Benfica_traint_op_bijvelden_Feijenoord,_Eus%C3%A9bio,_Bestanddeelnr_915-0216.jpg) |
| Ronald Koeman (1990) | `koeman-1990` | Rob Croes for Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Ronald_Koeman_(1983).jpg) |
| Lionel Messi (2015) | `messi-2015` | Addesolen | [Commons](https://commons.wikimedia.org/wiki/File:Lionel_Messi_at_Bernabeu.jpg) |
| Marco van Basten (1989) | `van-basten-1989` | NL-HaNA, ANEFO / neg. stroken, 1945-1989, 2.24.01.05, item number 934-4427 | [Commons](https://commons.wikimedia.org/wiki/File:Marco_van_Basten_1989_crop.jpg) |
| Kyle Walker (2025) | `walker-2025` | Timmy96 | [Commons](https://commons.wikimedia.org/wiki/File:Kyle_Walker_29112025_(2).jpg) |

### CC BY-SA 2.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Angel Di Maria (2014) | `di-maria-2014` | José Goulão from Lisbon, Portugal | [Commons](https://commons.wikimedia.org/wiki/File:%C3%81ngel_Di_Mar%C3%ADa.jpg) |
| Andres Iniesta (2018) | `iniesta-2018` | Tam Tam | [Commons](https://commons.wikimedia.org/wiki/File:Andres_Iniesta_2018_(edited)_(cropped).jpg) |
| Jordi Alba (2015) | `jordi-alba-2015` | Xavier Rondón Medina | [Commons](https://commons.wikimedia.org/wiki/File:Jordi_Alba_2013_Catalonia_(cropped).jpg) |
| Bixente Lizarazu (2001) | `lizarazu-2001` | Oscar Alonso Algote | [Commons](https://commons.wikimedia.org/wiki/File:Bixente_Lizarazu.jpg) |
| Son Heung-min (2021) | `son-2021` | Republic of Korea from Seoul, Republic of Korea | [Commons](https://commons.wikimedia.org/wiki/File:Son_Heung-min_-_2022_(52552243725)_(cropped).jpg) |
| Virgil van Dijk (2019) | `vandijk-2019` | @cfcunofficial (Chelsea Debs) London from London, UK | [Commons](https://commons.wikimedia.org/wiki/File:Virgil_van_Dijk_2019.jpg) |

### CC BY-SA 3.0 nl

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Bobby Moore (1966) | `bobby-moore-1966` | Eric Koch for Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Bobby_Moore_1969.jpg) |
| Dragan Dzajic (1968) | `dzajic-1968` | Nationaal Archief, Den Haag, Rijksfotoarchief: Fotocollectie Algemeen Nederlands Fotopersb | [Commons](https://commons.wikimedia.org/wiki/File:Dragan_D%C5%BEaji%C4%87.jpg) |
| Paco Gento (1960) | `gento-1960` | Unknown author Unknown author | [Commons](https://commons.wikimedia.org/wiki/File:Francisco_Gento_1962.jpg) |
| Lev Yashin (1963) | `yashin-1963` | Lindeboom, Henk / Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Lev_Yashin_1960b.jpg) |

### CC BY-SA 3.0 AT

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Fernandinho (2017) | `fernandinho-2017` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:20141118_AUTBRA_5044.jpg) |
| Neymar (2015) | `neymar-2015` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:20141118_AUTBRA_5089.jpg) |
| Thiago Silva (2013) | `thiago-silva-2013` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:20141118_1838_AUTBRA_4935.jpg) |
| Yaya Toure (2014) | `yaya-toure-2014` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:Yaya_Toure_9229.JPG) |

### CC BY 3.0 br

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Dani Alves (2021) | `dani-alves-2021` | Breno Barros | [Commons](https://commons.wikimedia.org/wiki/File:Dani_Alves_nos_Juegos_Olimpicos.jpg) |
| Ronaldo Nazario (2009) | `ronaldo-nazario-2009` | Ricardo Stuckert / Agência Brasil | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldo2009Corinthians.jpg) |

### CC BY-SA 3.0 NL

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Johan Cruyff (1974) | `cruyff-1974` | Bert Verhoeff / Anefo | [Commons](https://commons.wikimedia.org/wiki/File:Johan_Cruyff_1971c.jpg) |

### Attribution

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Michael Essien (2007) | `essien-2007` | Amarhgil | [Commons](https://commons.wikimedia.org/wiki/File:Michael_Essien_4620.jpg) |

### CC BY-SA 3.0 at

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Diego Godin (2014) | `godin-2014` | Ailura | [Commons](https://commons.wikimedia.org/wiki/File:U03_Diego_God%C3%ADn_7530.jpg) |

### CC BY-SA 1.0

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Paolo Maldini (2007) | `maldini-2007` | Yelena Rybakova | [Commons](https://commons.wikimedia.org/wiki/File:Maldini2008.JPG) |

### CC BY 3.0 BR

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Rivaldo (1999) | `rivaldo-1999` | Laura Cortizo/Portal da Copa | [Commons](https://commons.wikimedia.org/wiki/File:Rivaldo_(full_version).jpg) |

### CC BY-SA 2.0 DE

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Ronaldinho (2006) | `ronaldinho-2006` | Reto Stauffer | [Commons](https://commons.wikimedia.org/wiki/File:Ronaldinho061115.jpg) |

### CC BY 2.5

| Carta | Fichero | Autor | Fuente |
|---|---|---|---|
| Edwin van der Sar (2008) | `van-der-sar-2008` | Paul Blank | [Commons](https://commons.wikimedia.org/wiki/File:Edwin_van_der_Sar_side.jpg) |

