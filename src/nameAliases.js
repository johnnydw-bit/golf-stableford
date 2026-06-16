// Maps STT mishearings and nicknames → canonical first name (lowercase)
// Generated from names_stt_confusions.json
const NAME_ALIASES = {
  // Adam
  'add em':'adam','madam':'adam','atom':'adam','at him':'adam','ad ham':'adam','autumn':'adam',
  // Alan / Al
  'allen':'alan','ellen':'alan','island':'alan','allan':'alan','al in':'alan','alien':'alan','al':'alan',
  // Albert / Bert
  'owl bert':'albert','alert':'albert','albeit':'albert','bert':'albert',
  // Alexander / Alex / Alec / Xander
  'alec zander':'alexander','alex':'alexander','alec':'alexander','allies':'alexander','elect':'alexander','alexa':'alexander','xander':'alexander',
  // Alfred / Alf / Freddie — freddie also maps to frederick below; last write wins, both fine
  'elf red':'alfred','offered':'alfred','afraid':'alfred','ann fred':'alfred','alf':'alfred',
  // Andrew / Andy / Drew
  'an drew':'andrew','and you':'andrew','andy':'andrew','handy':'andrew','drew':'andrew','and raw':'andrew',
  // Anthony / Tony
  'an tony':'anthony','ant honey':'anthony','tony':'anthony','bony':'anthony','pony':'anthony','bounty':'anthony','toney':'anthony',
  // Arthur / Art
  'our thur':'arthur','author':'arthur','art':'arthur','archer':'arthur',
  // Barry
  'berry':'barry',
  // Benjamin / Ben / Benny / Benji
  'ben jamin':'benjamin','bend your man':'benjamin','pen':'benjamin','den':'benjamin','ban':'benjamin','ben gin':'benjamin','engine':'benjamin','ben':'benjamin','benny':'benjamin','benji':'benjamin',
  // Bernard / Bernie
  'burned':'bernard','bernie':'bernard','burnard':'bernard',
  // Bradley / Brad
  'badly':'bradley','brad lee':'bradley','brad':'bradley',
  // Brian / Bryan
  'brain':'brian','bray an':'brian','fryin':'brian','cryin':'brian','brine':'brian','ryan':'brian','brand':'brian','bryant':'brian','bryan':'brian',
  // Bruce
  'bruise':'bruce','boost':'bruce','brooks':'bruce','ruse':'bruce',
  // Cameron / Cam
  'camera on':'cameron','common':'cameron','camry on':'cameron','cam':'cameron',
  // Carl / Carlo
  'call':'carl','curl':'carl','car':'carl','karl':'carl','carlo':'carl',
  // Charles / Charlie / Chuck / Chas
  'sharls':'charles','charls':'charles','charlie':'charles','sharly':'charles','shuck':'charles','chills':'charles','jarles':'charles','sharpless':'charles','chuck':'charles','chapter':'charles','chas':'charles',
  // Christopher / Chris / Topher / Kit
  'kristopher':'christopher','chriss':'christopher','krish':'christopher','kiss':'christopher','crisp':'christopher','christ':'christopher','chris':'christopher','topher':'christopher','kit':'christopher',
  // Clive
  'alive':'clive','hive':'clive','drive':'clive',
  // Colin
  'call in':'colin','colon':'colin','cullen':'colin','calling':'colin','collin':'colin','cone':'colin',
  // Craig
  'crag':'craig','crack':'craig',
  // Curtis / Curt
  'curt us':'curtis','curd is':'curtis','courteous':'curtis','hurt us':'curtis','cart':'curtis','curt':'curtis',
  // Daniel / Dan / Danny
  'dan yell':'daniel','denial':'daniel','danny':'daniel','damn':'daniel','dan':'daniel',
  // David / Dave / Davey
  'day vid':'david','daybed':'david','gave':'david','cave':'david','daveed':'david','day visit':'david','divide':'david','dave':'david','davey':'david','tavid':'david',
  // Dean
  'deem':'dean','bean':'dean','lean':'dean',
  // Dennis / Den / Denny
  'tennis':'dennis','menace':'dennis','denis':'dennis','den is':'dennis','den':'dennis','denny':'dennis',
  // Derek / Del
  'derrick':'derek','dairy':'derek','direct':'derek','derry':'derek','del':'derek',
  // Donald / Don / Donny
  'dawn ald':'donald','don':'donald','dawn':'donald','done':'donald','donny':'donald',
  // Douglas / Doug
  'dug less':'douglas','doug glass':'douglas','doug':'douglas',
  // Duncan
  'dunkin':'duncan','donkin':'duncan','done can':'duncan',
  // Dylan
  'dillon':'dylan','villain':'dylan','dill in':'dylan',
  // Edward / Ed / Ted / Ned
  'headward':'edward','head':'edward','bed':'edward','ted':'edward','dead':'edward','backward':'edward','ed':'edward','ned':'edward',
  // Elliott / Ellie
  'eliot':'elliott','elli at':'elliott','ali ott':'elliott','elliot':'elliott','ellie':'elliott',
  // Eric / Rick
  'erik':'eric','air ik':'eric','earache':'eric','rick':'eric','brick':'eric','herrick':'eric',
  // Ethan
  'e thin':'ethan','heathen':'ethan','even':'ethan','e then':'ethan','e fan':'ethan','eathen':'ethan',
  // Finlay / Finn
  'finley':'finlay','finely':'finlay','find lay':'finlay','finn':'finlay',
  // Francis / Frank / Frankie
  'frances':'francis','frank sis':'francis','thanks sis':'francis','frank':'francis','frankie':'francis',
  // Frederick / Fred / Freddie
  'fed rick':'frederick','fredrick':'frederick','bread':'frederick','thread':'frederick','frantic':'frederick','fred':'frederick','freddie':'frederick',
  // Gabriel / Gabe
  'gay brie elle':'gabriel','cable':'gabriel','gable':'gabriel','gab':'gabriel','gail':'gabriel','abril':'gabriel','gabe':'gabriel',
  // Gary / Gare
  'gerry':'gary','jerry':'gary','hairy':'gary','scary':'gary','carry':'gary','dairy':'gary','gare':'gary',
  // George / Georgie
  'jorge':'george','gorge':'george','charge':'george','church':'george','judge':'george','georgia':'george','chore':'george','georgie':'george',
  // Gerald / Gerry
  'jerald':'gerald','jared':'gerald','general':'gerald','geraldine':'gerald','gerry':'gerald',
  // Gordon
  'garden':'gordon','golden':'gordon','gordan':'gordon',
  // Graham / Gray
  'gram':'graham','grand':'graham','gray ham':'graham','graeme':'graham','gray':'graham',
  // Hamish
  'ham ish':'hamish','famish':'hamish','armish':'hamish',
  // Harold / Harry / Hal
  'herald':'harold','hurl':'harold','arrow':'harold','how old':'harold','harrow':'harold','harry':'harold','hal':'harold',
  // Harvey
  'hard v':'harvey','army':'harvey','harpy':'harvey','heavy':'harvey',
  // Henry / Hank
  'hen ree':'henry','angry':'henry','entry':'henry','hen':'henry','hank':'henry',
  // Hugh
  'hue':'hugh','you':'hugh','huge':'hugh','hew':'hugh',
  // Ian
  'eon':'ian','iron':'ian','ean':'ian','ion':'ian',
  // Isaac / Izzy
  'eyesack':'isaac','ice egg':'isaac','icicle':'isaac','izzy':'isaac',
  // Jack / Jackie
  'jak':'jack','jacked':'jack','shack':'jack','track':'jack','jackie':'jack',
  // Jacob / Jake
  'jay cub':'jacob','jake':'jacob','make':'jacob','take':'jacob','cake':'jacob','bake':'jacob','wake':'jacob','shake':'jacob','check':'jacob',
  // James / Jim / Jimmy / Jamie
  'gym':'james','gyms':'james','gems':'james','jayms':'james','games':'james','aims':'james','chains':'james','jims':'james','shames':'james','gemes':'james','dames':'james','jim':'james','jimmy':'james','jamie':'james',
  // Jason / Jay
  'jay sun':'jason','chasing':'jason','jay':'jason','mason':'jason','hasten':'jason',
  // Jeffrey / Jeff
  'geoffrey':'jeffrey','chef ree':'jeffrey','jeff':'jeffrey','chef':'jeffrey','deaf':'jeffrey','chafing':'jeffrey','reff':'jeffrey',
  // John / Johnny / Jon
  'jon':'john','jan':'john','jean':'john','jawn':'john','shawn':'john','jaw':'john','join':'john','gene':'john','chon':'john','johnny':'john',
  // Jonathan / Nathan
  'johnathan':'jonathan','johnny then':'jonathan','marathon':'jonathan','nathan':'jonathan',
  // Joseph / Joe / Joey
  'jo seff':'joseph','yo sef':'joseph','jo':'joseph','show':'joseph','zoe':'joseph','joe':'joseph','joey':'joseph',
  // Joshua / Josh
  'josh away':'joshua','gosh':'joshua','wash':'joshua','gauche':'joshua','juice':'joshua','josh':'joshua',
  // Julian / Jules
  'jewel ian':'julian','jillian':'julian','julie an':'julian','jules':'julian',
  // Justin
  'just in':'justin','justine':'justin','dustin':'justin',
  // Keith
  'keef':'keith','teeth':'keith','keep':'keith','heat':'keith','key':'keith',
  // Kenneth / Ken / Kenny
  'ken net':'kenneth','ten':'kenneth','men':'kenneth','kenny':'kenneth','can':'kenneth','glen':'kenneth','ken':'kenneth',
  // Kevin / Kev
  'kay vin':'kevin','heaven':'kevin','seven':'kevin','kev':'kevin','cabin':'kevin','gavin':'kevin','coven':'kevin',
  // Kieran
  'kiran':'kieran','curry on':'kieran','kear ran':'kieran',
  // Kyle
  'kile':'kyle','tile':'kyle','style':'kyle','while':'kyle',
  // Lawrence / Larry
  'lorence':'lawrence','florence':'lawrence','law rents':'lawrence','lori':'lawrence','lauren':'lawrence','warrants':'lawrence','larry':'lawrence',
  // Lee / Leigh
  'leigh':'lee','league':'lee','leak':'lee','leap':'lee',
  // Leo / Leah
  'leah oh':'leo','leah':'leo','ohio':'leo',
  // Leonard / Len / Lenny
  'len ard':'leonard','lenard':'leonard','leopard':'leonard','len':'leonard','lenny':'leonard',
  // Liam
  'lee am':'liam','lima':'liam','leon':'liam',
  // Logan / Logie
  'low gun':'logan','log in':'logan','longing':'logan','lawn':'logan','logie':'logan',
  // Louis / Lou / Louie
  'lou is':'louis','lewis':'louis','looey':'louis','bluey':'louis','lose':'louis','glue':'louis','lou':'louis','louie':'louis',
  // Lucas / Luke (luke also standalone below)
  'loo cas':'lucas','look as':'lucas','luca':'lucas',
  // Luke
  'look':'luke','lewk':'luke','luck':'luke',
  // Malcolm / Mal
  'mal come':'malcolm','balcom':'malcolm','mal cum':'malcolm','mal':'malcolm',
  // Mark / Marcus / Marc
  'marx':'mark','bark':'mark','dark':'mark','park':'mark','arc':'mark','mock':'mark','mart':'mark','mar':'mark','marcus':'mark','marc':'mark',
  // Martin / Marty
  'mart in':'martin','martian':'martin','margin':'martin','marlin':'martin','marty':'martin','marching':'martin',
  // Mason
  'may son':'mason','basin':'mason','mace on':'mason',
  // Matthew / Matt / Matty
  'math you':'matthew','math':'matthew','mat':'matthew','bat':'matthew','fat':'matthew','cat':'matthew','rat':'matthew','match':'matthew','mighty':'matthew','pat':'matthew','matt':'matthew','matty':'matthew',
  // Max
  'macs':'max','fax':'max','tax':'max',
  // Michael / Mike / Mikey
  'my cool':'michael','my gull':'michael','mic':'michael','bike':'michael','hike':'michael','like':'michael','my call':'michael','meek':'michael','miko':'michael','my goal':'michael','mike':'michael','mikey':'michael',
  // Neil / Neal
  'kneel':'neil','real':'neil','deal':'neil','neal':'neil',
  // Nicholas / Nick / Nicky
  'nikolas':'nicholas','neck less':'nicholas','neck':'nicholas','sick':'nicholas','pick':'nicholas','nicole':'nicholas','nickel':'nicholas','nick':'nicholas','nicky':'nicholas',
  // Nigel
  'nye jel':'nigel','nye gel':'nigel','nichol':'nigel',
  // Noah / Nora
  'nora':'noah','no ah':'noah','know her':'noah',
  // Norman / Norm
  'norm an':'norman','north man':'norman','doorman':'norman','norm':'norman',
  // Oliver / Ollie
  'olive er':'oliver','all of her':'oliver','ali ver':'oliver','ollie':'oliver',
  // Oscar
  'ask her':'oscar','ah skar':'oscar','boxer':'oscar',
  // Owen
  'owin':'owen','going':'owen','oh in':'owen','ocean':'owen',
  // Patrick / Pat / Rick (rick already→eric; here context differs — just add pat)
  'pat rick':'patrick','hat trick':'patrick','hat':'patrick','past':'patrick','pack':'patrick','pat':'patrick',
  // Paul
  'pall':'paul','poll':'paul','ball':'paul','fall':'paul','hall':'paul','tall':'paul','wall':'paul','pull':'paul','pool':'paul','paw':'paul',
  // Peter / Pete
  'pita':'peter','beat her':'peter','heater':'peter','meter':'peter','peach':'peter','pete':'peter',
  // Philip / Phil / Pip
  'phillip':'philip','fill up':'philip','fillip':'philip','fill':'philip','feel':'philip','pill':'philip','hill':'philip','full up':'philip','flip':'philip','phil':'philip','pip':'philip','filled':'philip','field':'philip','build':'philip',
  // Quentin
  'kwen tin':'quentin','question':'quentin','kentin':'quentin',
  // Raymond / Ray
  'ray mond':'raymond','rain man':'raymond','ramen':'raymond','raven':'raymond','ray':'raymond','roman':'raymond',
  // Reuben / Roo
  'ruben':'reuben','ruin':'reuben','reuban':'reuben','roo':'reuben',
  // Rhys
  'reece':'rhys','rice':'rhys','reese':'rhys','rees':'rhys',
  // Richard / Dick / Rich / Richie
  'wretched':'richard','rich art':'richard','richer':'richard','pitcher':'richard','chick':'richard','dick':'richard','rich':'richard','richie':'richard','dickie':'richard',
  // Robert / Bob / Rob / Bert / Bobby
  'raw bert':'robert','rob art':'robert','bop':'robert','pop':'robert','rob':'robert','wrap':'robert','rub':'robert','bought':'robert','rubber':'robert','herb':'robert','board':'robert','bob':'robert','bobby':'robert','bobbie':'robert',
  // Roger / Rog
  'lodger':'roger','dodger':'roger','rodger':'roger','rager':'roger','roja':'roger','rog':'roger',
  // Ronald / Ron / Ronny
  'raw nald':'ronald','ron':'ronald','run':'ronald','bon':'ronald','wrong':'ronald','ran':'ronald','rum':'ronald','ronny':'ronald',
  // Russell / Russ
  'rustle':'russell','russel':'russell','muscle':'russell','hustle':'russell','wrestle':'russell','russ':'russell',
  // Ryan / Ry
  'wry an':'ryan','lion':'ryan','rhythm':'ryan','riot':'ryan','rain':'ryan','rye':'ryan','bryan':'ryan','ry':'ryan',
  // Samuel / Sam / Sammy
  'sand mule':'samuel','same you':'samuel','sham':'samuel','slam':'samuel','sum':'samuel','salmon':'samuel','sam well':'samuel','sam':'samuel','sammy':'samuel',
  // Scott
  'got':'scott','shot':'scott','spot':'scott','cot':'scott','scotch':'scott',
  // Sean / Shaun / Shawn
  'shawn':'sean','shorn':'sean','shone':'sean','shaun':'sean',
  // Simon / Si
  'simian':'simon','sigh man':'simon','simmons':'simon','si':'simon',
  // Stanley / Stan
  'stan lee':'stanley','stand lee':'stanley','stan':'stanley',
  // Steven / Steve / Stevie / Stephen
  'stephen':'steven','steve':'steven','sleeve':'steven','leave':'steven','stiff':'steven','steed':'steven','thief':'steven','stevie':'steven',
  // Stuart / Stu
  'stew art':'stuart','stewart':'stuart','stew it':'stuart','stu':'stuart',
  // Terry
  'ferry':'terry','merry':'terry',
  // Theo
  'the oh':'theo','tao':'theo',
  // Thomas / Tom / Tommy
  'toe mas':'thomas','promise':'thomas','bomb':'thomas','mom':'thomas','calm':'thomas','dom':'thomas','tummy':'thomas','timmy':'thomas','tom':'thomas','tommy':'thomas',
  // Timothy / Tim / Timmy
  'tim moth ee':'timothy','dim':'timothy','rim':'timothy','gimme':'timothy','thin':'timothy','team':'timothy','tim':'timothy',
  // Toby
  'tobey':'toby','to be':'toby','tubby':'toby',
  // Trevor / Trev
  'treble':'trevor','travel':'trevor','driver':'trevor','forever':'trevor','river':'trevor','trev':'trevor',
  // Victor / Vic
  'vic tor':'victor','vector':'victor','victa':'victor','vic':'victor',
  // Vincent / Vince
  'vin cent':'vincent','vin sent':'vincent','vince':'vincent',
  // Walter / Walt
  'water':'walter','vault her':'walter','halter':'walter','walker':'walter','waller':'walter','walt':'walter',
  // Warren
  'warning':'warren','war in':'warren','worn':'warren',
  // Wayne
  'wain':'wayne','wane':'wayne','main':'wayne','vain':'wayne',
  // William / Will / Bill / Billy / Willy
  'will yum':'william','will ham':'william','will ee um':'william','will':'william','bill':'william','billy':'william','willy':'william',
  // Zachary / Zac / Zack
  'zac uh ree':'zachary','zach ree':'zachary','zachery':'zachary','zac':'zachary','zack':'zachary',
}

export function resolveNames(transcript) {
  let t = transcript.toLowerCase()
  // Sort by length descending so multi-word aliases match before substrings
  const entries = Object.entries(NAME_ALIASES).sort((a, b) => b[0].length - a[0].length)
  for (const [alias, canonical] of entries) {
    t = t.replace(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), canonical)
  }
  return t
}
