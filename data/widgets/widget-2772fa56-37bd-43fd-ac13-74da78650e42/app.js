// === MOT DU JOUR ===

const WORDS = [
  { word: "Abracadabrant", cat: "adj.", phonetic: "/a.bʁa.ka.da.bʁɑ̃/", def: "Extraordinaire, invraisemblable, qui échappe à toute logique.", ex: "Il m'a sorti une excuse abracabrante pour justifier son retard." },
  { word: "Acrimonie", cat: "n.f.", phonetic: "/a.kʁi.mɔ.ni/", def: "Mauvaise humeur qui se manifeste par des paroles aigres et mordantes.", ex: "Il répondit avec une acrimonie qui surprit tout le monde dans la salle." },
  { word: "Affable", cat: "adj.", phonetic: "/a.fabl/", def: "D'une politesse aimable et douce qui met les gens à l'aise.", ex: "La directrice est connue pour être affable avec tous ses collaborateurs." },
  { word: "Alacritié", cat: "n.f.", phonetic: "/a.la.kʁi.te/", def: "Vivacité joyeuse, entrain remarquable dans l'action.", ex: "Il se leva avec alacritié pour accueillir les invités." },
  { word: "Amphigouri", cat: "n.m.", phonetic: "/ɑ̃.fi.ɡu.ʁi/", def: "Discours ou écrit obscur et confus sans aucun sens apparent.", ex: "Son rapport était un véritable amphigouri que personne n'a compris." },
  { word: "Anachronique", cat: "adj.", phonetic: "/a.na.kʁɔ.nik/", def: "Qui est d'une autre époque, inadapté au temps présent.", ex: "Porter une cravate au bureau est devenu assez anachronique de nos jours." },
  { word: "Antinomique", cat: "adj.", phonetic: "/ɑ̃.ti.nɔ.mik/", def: "Qui présente une contradiction irréductible entre deux principes.", ex: "Ces deux positions sont totalement antinomiques, on ne peut les concilier." },
  { word: "Aphorisme", cat: "n.m.", phonetic: "/a.fɔ.ʁism/", def: "Courte formule condensant une vérité générale de façon frappante.", ex: "Il conclut la réunion avec un aphorisme bien choisi." },
  { word: "Apocryphe", cat: "adj.", phonetic: "/a.pɔ.kʁif/", def: "Dont l'authenticité est douteuse ou contestée.", ex: "Cette citation apocryphe est pourtant répétée partout sur internet." },
  { word: "Apothéose", cat: "n.f.", phonetic: "/a.pɔ.te.oz/", def: "Le point culminant, la plus haute expression de quelque chose.", ex: "Le concert s'est terminé en apothéose avec un feu d'artifice." },
  { word: "Atermoiement", cat: "n.m.", phonetic: "/a.tɛʁ.mwa.mɑ̃/", def: "Action de remettre sans cesse à plus tard, tergiversation.", ex: "Ses atermoiements nous ont fait perdre un contrat précieux." },
  { word: "Atavique", cat: "adj.", phonetic: "/a.ta.vik/", def: "Qui ressemble à un ancêtre lointain, qui vient des origines.", ex: "Il a une peur atavique des espaces confinés." },
  { word: "Bienséance", cat: "n.f.", phonetic: "/bjɛ̃.se.ɑ̃s/", def: "Ensemble des règles de conduite considérées comme convenables en société.", ex: "Il a oublié toute bienséance en coupant la parole au directeur." },
  { word: "Casuistique", cat: "n.f.", phonetic: "/ka.zɥis.tik/", def: "Art de résoudre des cas de conscience, souvent avec des subtilités excessives.", ex: "Sa casuistique lui permettait de justifier n'importe quelle décision." },
  { word: "Circonspect", cat: "adj.", phonetic: "/siʁ.kɔ̃.spɛkt/", def: "Qui agit avec prudence et retenue, en pesant bien ses mots.", ex: "Sois circonspect avant de répondre, c'est un sujet sensible." },
  { word: "Clivant", cat: "adj.", phonetic: "/kli.vɑ̃/", def: "Qui divise profondément, qui crée un clivage dans l'opinion.", ex: "C'est un sujet clivant sur lequel il vaut mieux ne pas s'exprimer en réunion." },
  { word: "Cogiter", cat: "v.", phonetic: "/kɔ.ʒi.te/", def: "Réfléchir profondément, méditer longuement sur un sujet.", ex: "Il cogite depuis des heures sur la meilleure façon d'aborder la question." },
  { word: "Complaisant", cat: "adj.", phonetic: "/kɔ̃.plɛ.zɑ̃/", def: "Qui cherche à plaire en se montrant accommodant à l'excès.", ex: "Il est trop complaisant avec ses clients, ce qui nuit à son autorité." },
  { word: "Concupiscence", cat: "n.f.", phonetic: "/kɔ̃.ky.pi.sɑ̃s/", def: "Désir ardent, attirance intense vers quelque chose ou quelqu'un.", ex: "Il regardait la vitrine de la pâtisserie avec une concupiscence non dissimulée." },
  { word: "Congruent", cat: "adj.", phonetic: "/kɔ̃.ɡʁy.ɑ̃/", def: "Qui est en accord parfait, qui correspond exactement à la situation.", ex: "Sa réponse n'était pas vraiment congruente avec ce qu'on lui avait demandé." },
  { word: "Consternant", cat: "adj.", phonetic: "/kɔ̃s.tɛʁ.nɑ̃/", def: "Qui plonge dans une stupeur mêlée de découragement.", ex: "Son niveau de préparation était consternant pour une présentation aussi importante." },
  { word: "Contrit", cat: "adj.", phonetic: "/kɔ̃.tʁi/", def: "Qui éprouve un repentir sincère et profond.", ex: "Il est revenu tout contrit après avoir réalisé son erreur." },
  { word: "Coruscant", cat: "adj.", phonetic: "/kɔ.ʁys.kɑ̃/", def: "Qui brille d'un éclat vif, brillant et étincelant.", ex: "Son esprit coruscant illuminait chaque conversation." },
  { word: "Cupide", cat: "adj.", phonetic: "/ky.pid/", def: "Qui a un désir excessif de richesse, avide de gains.", ex: "Ne sois pas si cupide, partage un peu de ta chance." },
  { word: "Déconcertant", cat: "adj.", phonetic: "/de.kɔ̃.sɛʁ.tɑ̃/", def: "Qui trouble, déroute complètement par son caractère inattendu.", ex: "Sa logique est déconcertante, mais elle aboutit toujours au bon résultat." },
  { word: "Déférent", cat: "adj.", phonetic: "/de.fe.ʁɑ̃/", def: "Qui témoigne du respect, de la considération envers quelqu'un.", ex: "Elle était très déférente envers les anciens de l'entreprise." },
  { word: "Délétère", cat: "adj.", phonetic: "/de.le.tɛʁ/", def: "Nuisible à la santé ou à l'esprit, corrupteur.", ex: "Cette ambiance délétère finit par affecter toute l'équipe." },
  { word: "Désuet", cat: "adj.", phonetic: "/de.sɥɛ/", def: "Tombé en désuétude, qui n'est plus en usage.", ex: "Cette façon de s'exprimer est un peu désuète mais charme par son élégance." },
  { word: "Dichotomie", cat: "n.f.", phonetic: "/di.kɔ.tɔ.mi/", def: "Division en deux parties opposées et complémentaires.", ex: "Il y a une vraie dichotomie entre ce qu'il dit et ce qu'il fait." },
  { word: "Dilettante", cat: "n.", phonetic: "/di.lɛ.tɑ̃t/", def: "Personne qui pratique un art ou une activité en amateur, sans rigueur.", ex: "Il s'approche du problème en dilettante, sans vraiment s'y investir." },
  { word: "Dirimant", cat: "adj.", phonetic: "/di.ʁi.mɑ̃/", def: "Qui annule complètement, qui constitue un empêchement absolu.", ex: "Ce détail technique est un obstacle dirimant à notre accord." },
  { word: "Duplicité", cat: "n.f.", phonetic: "/dy.pli.si.te/", def: "Caractère d'une personne qui dissimule sa vraie nature, hypocrisie.", ex: "Sa duplicité nous a tous surpris : personne ne l'avait vue venir." },
  { word: "Édulcorer", cat: "v.", phonetic: "/e.dyl.kɔ.ʁe/", def: "Atténuer la force ou la virulence de quelque chose pour le rendre plus acceptable.", ex: "Il a édulcoré son rapport pour ne pas froisser la direction." },
  { word: "Effigie", cat: "n.f.", phonetic: "/ɛ.fi.ʒi/", def: "Représentation d'une personne sur une médaille, un billet ou une statue.", ex: "Il est arrivé comme s'il portait l'effigie de la marque sur lui." },
  { word: "Éloquent", cat: "adj.", phonetic: "/e.lɔ.kɑ̃/", def: "Qui s'exprime avec force et persuasion, qui parle avec aisance.", ex: "Son silence était plus éloquent que n'importe quel discours." },
  { word: "Éphémère", cat: "adj.", phonetic: "/e.fe.mɛʁ/", def: "Qui est de courte durée, qui passe très vite.", ex: "Le succès de cette tendance s'est avéré bien éphémère." },
  { word: "Équivoque", cat: "adj.", phonetic: "/e.ki.vɔk/", def: "Qui peut être interprété de plusieurs façons, ambigu.", ex: "Sa réponse était équivoque et n'a rassuré personne." },
  { word: "Ésotérique", cat: "adj.", phonetic: "/e.zɔ.te.ʁik/", def: "Réservé aux initiés, difficile à comprendre pour le grand public.", ex: "Son humour est un peu ésotérique, peu de gens le comprennent." },
  { word: "Euphémisme", cat: "n.m.", phonetic: "/ø.fe.mism/", def: "Manière d'exprimer quelque chose de déplaisant en termes atténués.", ex: "Dire qu'il est 'direct' est un euphémisme pour 'grossier'." },
  { word: "Exacerber", cat: "v.", phonetic: "/ɛɡ.za.sɛʁ.be/", def: "Rendre plus intense, aggraver jusqu'à l'excès.", ex: "Ce retard a exacerbé les tensions déjà présentes dans l'équipe." },
  { word: "Facétieux", cat: "adj.", phonetic: "/fa.se.sjø/", def: "Qui aime plaisanter, faire des farces avec un esprit espiègle.", ex: "Il a placé un commentaire facétieux dans le compte-rendu, personne ne l'a vu." },
  { word: "Fallacieux", cat: "adj.", phonetic: "/fa.la.sjø/", def: "Trompeur, fondé sur une erreur volontaire ou un raisonnement faux.", ex: "Cet argument est fallacieux et ne résiste pas à l'analyse." },
  { word: "Fébrilité", cat: "n.f.", phonetic: "/feb.ʁi.li.te/", def: "État d'agitation, d'impatience fébrile mêlée d'excitation.", ex: "On sentait la fébrilité des équipes avant le lancement du produit." },
  { word: "Félonie", cat: "n.f.", phonetic: "/fe.lɔ.ni/", def: "Trahison envers quelqu'un à qui on doit loyauté.", ex: "Il considère ce revirement comme une félonie envers leurs valeurs communes." },
  { word: "Flegmatique", cat: "adj.", phonetic: "/flɛɡ.ma.tik/", def: "D'un calme imperturbable, qui ne se laisse pas émouvoir.", ex: "Il est resté flegmatique face aux critiques, ce qui a tout désarmé." },
  { word: "Flou artistique", cat: "loc.", phonetic: "", def: "Imprécision volontaire, manque de clarté entretenu stratégiquement.", ex: "Il maintient un flou artistique sur ses intentions, ce qui intrigue tout le monde." },
  { word: "Forfanterie", cat: "n.f.", phonetic: "/fɔʁ.fɑ̃.tʁi/", def: "Vantardise impudente, fanfaronnade exagérée.", ex: "Sa forfanterie finit par lasser même ses plus grands admirateurs." },
  { word: "Fulgurant", cat: "adj.", phonetic: "/fyl.ɡy.ʁɑ̃/", def: "Qui est aussi rapide et brillant qu'un éclair.", ex: "Sa progression dans l'entreprise a été fulgurante, deux promotions en un an." },
  { word: "Fumeux", cat: "adj.", phonetic: "/fy.mø/", def: "Confus, obscur, difficile à comprendre (pour une idée ou un raisonnement).", ex: "Son plan est un peu fumeux, personne ne sait vraiment ce qu'il entend par là." },
  { word: "Galvauder", cat: "v.", phonetic: "/ɡal.vo.de/", def: "Employer à mauvais escient, dévaluer par un usage trop fréquent.", ex: "Le terme 'révolution' est tellement galvaudé qu'il n'a plus aucun sens." },
  { word: "Hégémonie", cat: "n.f.", phonetic: "/e.ʒe.mɔ.ni/", def: "Domination, suprématie d'un état, d'une entité sur les autres.", ex: "Cette entreprise cherche à établir son hégémonie sur le marché européen." },
  { word: "Iconoclaste", cat: "adj.", phonetic: "/i.kɔ.nɔ.klast/", def: "Qui s'attaque aux traditions, aux idées reçues pour les détruire.", ex: "Son approche iconoclaste a complètement bousculé les codes du secteur." },
  { word: "Idiosyncrasie", cat: "n.f.", phonetic: "/i.djɔ.sɛ̃.kʁa.zi/", def: "Manière d'être particulière à chaque individu, qui le distingue des autres.", ex: "Ses idiosyncrasies font partie de ce qui le rend si attachant." },
  { word: "Imperturbable", cat: "adj.", phonetic: "/ɛ̃.pɛʁ.tyʁ.babl/", def: "Que rien ne peut troubler, d'un calme absolu.", ex: "Elle est restée imperturbable malgré la pression énorme de cette journée." },
  { word: "Impétrant", cat: "n.m.", phonetic: "/ɛ̃.pe.tʁɑ̃/", def: "Personne qui obtient un titre, un diplôme ou une autorisation.", ex: "L'impétrant a remercié son jury avec une émotion palpable." },
  { word: "Implacable", cat: "adj.", phonetic: "/ɛ̃.pla.kabl/", def: "À quoi on ne peut résister, d'une rigueur absolue.", ex: "Sa logique implacable a réduit à néant tous les contre-arguments." },
  { word: "Improbable", cat: "adj.", phonetic: "/ɛ̃.pʁɔ.babl/", def: "Qui a peu de chances de se produire ou qui est insolite.", ex: "Ils forment un duo assez improbable, mais ça fonctionne à merveille." },
  { word: "Inadvertance", cat: "n.f.", phonetic: "/in.ad.vɛʁ.tɑ̃s/", def: "Manque d'attention, acte commis par étourderie.", ex: "C'est par inadvertance qu'il a révélé l'information à toute la salle." },
  { word: "Incongru", cat: "adj.", phonetic: "/ɛ̃.kɔ̃.ɡʁy/", def: "Qui ne convient pas à la situation, déplacé, bizarre.", ex: "Sa blague était totalement incongrue dans ce contexte solennel." },
  { word: "Inénarrable", cat: "adj.", phonetic: "/in.e.na.ʁabl/", def: "Qu'on ne peut raconter tant c'est drôle, bizarre ou extraordinaire.", ex: "La réunion a tourné à l'inénarrable quand le chef a confondu les noms." },
  { word: "Inexorable", cat: "adj.", phonetic: "/in.ɛɡ.zɔ.ʁabl/", def: "Qu'on ne peut fléchir, arrêter ; d'une progression implacable.", ex: "La marche inexorable du temps finit par rendre ce débat obsolète." },
  { word: "Ingénu", cat: "adj.", phonetic: "/ɛ̃.ʒe.ny/", def: "Qui a une naïveté sincère, naturelle, parfois désarmante.", ex: "Il posait des questions ingénues qui mettaient tout le monde mal à l'aise." },
  { word: "Inquisiteur", cat: "adj.", phonetic: "/ɛ̃.ki.zi.tœʁ/", def: "Qui cherche à sonder, à scruter avec insistance.", ex: "Il lui lança un regard inquisiteur qui ne demandait pas à être ignoré." },
  { word: "Insondable", cat: "adj.", phonetic: "/ɛ̃.sɔ̃.dabl/", def: "Si profond, si mystérieux qu'on ne peut le comprendre totalement.", ex: "Les motivations de ce choix restent insondables pour tous ses proches." },
  { word: "Interloqué", cat: "adj.", phonetic: "/ɛ̃.tɛʁ.lɔ.ke/", def: "Frappé de stupeur, déconcerté au point de ne savoir quoi répondre.", ex: "Il est resté interloqué quelques secondes avant de trouver ses mots." },
  { word: "Irascible", cat: "adj.", phonetic: "/i.ʁa.sibl/", def: "Qui se met facilement en colère, de tempérament colérique.", ex: "Il est irascible le matin, mieux vaut lui parler après 10h." },
  { word: "Lacunaire", cat: "adj.", phonetic: "/la.ky.nɛʁ/", def: "Qui présente des lacunes, des manques importants.", ex: "Son analyse est lacunaire sur plusieurs points essentiels." },
  { word: "Lapidaire", cat: "adj.", phonetic: "/la.pi.dɛʁ/", def: "D'une concision extrême, qui va droit au but en peu de mots.", ex: "Sa réponse lapidaire a clos le débat immédiatement." },
  { word: "Lénifiant", cat: "adj.", phonetic: "/le.ni.fjɑ̃/", def: "Qui apaise, qui atténue les tensions ou les souffrances.", ex: "Son discours lénifiant a calmé l'assemblée de façon remarquable." },
  { word: "Loquace", cat: "adj.", phonetic: "/lɔ.kwas/", def: "Qui parle beaucoup, bavard mais de manière agréable.", ex: "Il n'était pas particulièrement loquace ce jour-là, ce qui nous a tous surpris." },
  { word: "Magnanimité", cat: "n.f.", phonetic: "/ma.ɲa.ni.mi.te/", def: "Grandeur d'âme, générosité noble envers les vaincus ou les adversaires.", ex: "Il a montré une magnanimité rare en acceptant les excuses de son rival." },
  { word: "Malencontreusement", cat: "adv.", phonetic: "/ma.lɑ̃.kɔ̃.tʁøz.mɑ̃/", def: "D'une façon malheureuse, inopportune, au mauvais moment.", ex: "Il a malencontreusement mentionné le sujet tabou devant tout le monde." },
  { word: "Matutinal", cat: "adj.", phonetic: "/ma.ty.ti.nal/", def: "Qui a rapport au matin, qui se produit tôt le matin.", ex: "Ses activités matutinales incluent toujours une heure de lecture." },
  { word: "Méandre", cat: "n.m.", phonetic: "/me.ɑ̃dʁ/", def: "Sinuosité, détour compliqué dans un raisonnement ou un discours.", ex: "Il s'est perdu dans les méandres de son propre argumentaire." },
  { word: "Mégalomane", cat: "adj.", phonetic: "/me.ɡa.lɔ.man/", def: "Qui a un désir excessif de grandeur, de gloire ou de puissance.", ex: "Son projet est un peu mégalomane, mais ça ne manque pas d'audace." },
  { word: "Mirobolant", cat: "adj.", phonetic: "/mi.ʁɔ.bɔ.lɑ̃/", def: "Étonnant, fabuleux, trop beau pour être facilement crédible.", ex: "Il nous a présenté des chiffres mirobolants qui n'ont convaincu personne." },
  { word: "Moribond", cat: "adj.", phonetic: "/mɔ.ʁi.bɔ̃/", def: "Qui est sur le point de mourir ou de disparaître.", ex: "Ce modèle économique est moribond, il faudra s'y adapter." },
  { word: "Munificence", cat: "n.f.", phonetic: "/my.ni.fi.sɑ̃s/", def: "Grande générosité, libéralité ostentatoire.", ex: "La munificence du mécène a permis de sauver le festival." },
  { word: "Nébuleux", cat: "adj.", phonetic: "/ne.by.lø/", def: "Obscur, confus, difficile à saisir ou à définir.", ex: "Ses explications restaient nébuleuses malgré nos nombreuses questions." },
  { word: "Nonobstant", cat: "prép.", phonetic: "/nɔ.nɔbs.tɑ̃/", def: "Malgré, en dépit de — marque une opposition.", ex: "Nonobstant les difficultés, il a mené le projet à terme." },
  { word: "Obsolète", cat: "adj.", phonetic: "/ɔb.sɔ.lɛt/", def: "Qui est dépassé, sorti d'usage, plus adapté au contexte actuel.", ex: "Ce processus est complètement obsolète, il faut le remettre à jour." },
  { word: "Opportuniste", cat: "adj.", phonetic: "/ɔ.pɔʁ.ty.nist/", def: "Qui profite des circonstances sans se soucier de principes fixes.", ex: "C'est une décision opportuniste, mais difficile de lui donner tort." },
  { word: "Ostentation", cat: "n.f.", phonetic: "/ɔs.tɑ̃.ta.sjɔ̃/", def: "Étalage excessif d'une qualité ou d'un bien pour attirer l'attention.", ex: "Il portait sa montre avec une ostentation qui en disait long." },
  { word: "Parangon", cat: "n.m.", phonetic: "/pa.ʁɑ̃.ɡɔ̃/", def: "Modèle de perfection, exemple accompli d'une qualité.", ex: "Il se présente comme un parangon de vertu, ce qui agace ses collègues." },
  { word: "Parcimonieux", cat: "adj.", phonetic: "/paʁ.si.mɔ.njø/", def: "Qui dépense ou distribue avec une grande économie, chiche.", ex: "Il est parcimonieux avec les compliments, ce qui les rend d'autant plus précieux." },
  { word: "Pédant", cat: "adj.", phonetic: "/pe.dɑ̃/", def: "Qui étale son savoir de façon prétentieuse et importune.", ex: "Il devient un peu pédant quand il parle de son domaine d'expertise." },
  { word: "Péremptoire", cat: "adj.", phonetic: "/pe.ʁɑ̃p.twaʁ/", def: "Qui tranche définitivement, qui n'admet pas de réplique.", ex: "Il a tranché d'un ton péremptoire qui a mis fin à la discussion." },
  { word: "Pérenniser", cat: "v.", phonetic: "/pe.ʁe.ni.ze/", def: "Rendre durable, faire en sorte que quelque chose dure dans le temps.", ex: "L'objectif est de pérenniser ce partenariat sur le long terme." },
  { word: "Périphrastique", cat: "adj.", phonetic: "/pe.ʁi.fʁas.tik/", def: "Qui emploie des périphrases, qui dit les choses en beaucoup de mots.", ex: "Sa façon de refuser est tellement périphrastique qu'on ne comprend pas toujours." },
  { word: "Perspicace", cat: "adj.", phonetic: "/pɛʁs.pi.kas/", def: "Qui comprend vite et bien, qui pénètre les choses avec finesse.", ex: "Tu es perspicace, tu as vu le problème avant tout le monde." },
  { word: "Phénoménal", cat: "adj.", phonetic: "/fe.nɔ.me.nal/", def: "Qui dépasse les limites ordinaires, extraordinaire.", ex: "Sa mémoire est phénoménale, il se souvient de tout sans prendre de notes." },
  { word: "Plébisciter", cat: "v.", phonetic: "/ple.bi.si.te/", def: "Approuver massivement, adopter par un soutien très large.", ex: "Cette solution a été plébiscitée par l'ensemble des participants." },
  { word: "Pragmatique", cat: "adj.", phonetic: "/pʁaɡ.ma.tik/", def: "Qui privilégie l'action concrète et les résultats aux théories.", ex: "Soyons pragmatiques : qu'est-ce qui peut être fait dès demain matin ?" },
  { word: "Prégnant", cat: "adj.", phonetic: "/pʁe.ɲɑ̃/", def: "Qui s'impose fortement à l'esprit, qui a une grande force d'empreinte.", ex: "L'image est restée prégnante dans tous les esprits bien après la réunion." },
  { word: "Prépondérant", cat: "adj.", phonetic: "/pʁe.pɔ̃.de.ʁɑ̃/", def: "Qui a plus de poids, d'influence que les autres éléments.", ex: "Son rôle a été prépondérant dans la réussite de ce projet." },
  { word: "Procrastiner", cat: "v.", phonetic: "/pʁɔ.kʁas.ti.ne/", def: "Remettre systématiquement à plus tard ce qu'on devrait faire maintenant.", ex: "J'ai procrastiné toute la semaine, il faut vraiment que je m'y mette." },
  { word: "Prodigieux", cat: "adj.", phonetic: "/pʁɔ.di.ʒjø/", def: "Qui tient du prodige, extraordinaire par sa qualité ou son ampleur.", ex: "L'énergie qu'il déploie pour ce projet est vraiment prodigieuse." },
  { word: "Prolixe", cat: "adj.", phonetic: "/pʁɔ.liks/", def: "Qui parle ou écrit trop longuement, qui manque de concision.", ex: "Il est prolixe dans ses emails, ce qui rend la lecture fastidieuse." },
  { word: "Prosaïque", cat: "adj.", phonetic: "/pʁɔ.za.ik/", def: "Qui manque d'élévation, de poésie, qui est banal et terre à terre.", ex: "La réalité est souvent plus prosaïque que ce qu'on avait imaginé." },
  { word: "Pusillanime", cat: "adj.", phonetic: "/py.zi.la.nim/", def: "Qui manque de courage, qui craint de prendre des risques.", ex: "Sa réponse pusillanime n'a convaincu personne d'agir." },
  { word: "Quintessence", cat: "n.f.", phonetic: "/kɛ̃.tɛ.sɑ̃s/", def: "Ce qu'il y a de plus pur, de plus essentiel dans quelque chose.", ex: "Ce discours est la quintessence de ce que nous défendons depuis des années." },
  { word: "Rébarbatif", cat: "adj.", phonetic: "/ʁe.baʁ.ba.tif/", def: "Qui rebute par son aspect sévère, austère ou ennuyeux.", ex: "Le sujet est rébarbatif au premier abord, mais il devient vite passionnant." },
  { word: "Récalcitrant", cat: "adj.", phonetic: "/ʁe.kal.si.tʁɑ̃/", def: "Qui résiste avec obstination, qui refuse de se soumettre.", ex: "Même le membre le plus récalcitrant a fini par adhérer à la décision." },
  { word: "Résilience", cat: "n.f.", phonetic: "/ʁe.zi.ljɑ̃s/", def: "Capacité à surmonter les épreuves et à se reconstruire après un choc.", ex: "La résilience de l'équipe face à cette crise a été impressionnante." },
  { word: "Rhétorique", cat: "n.f.", phonetic: "/ʁe.tɔ.ʁik/", def: "Art de bien parler pour convaincre, ensemble de procédés discursifs.", ex: "Sa rhétorique est habile, mais elle cache un vide argumentaire réel." },
  { word: "Rondement", cat: "adv.", phonetic: "/ʁɔ̃d.mɑ̃/", def: "Avec efficacité, franchise et sans détour inutile.", ex: "L'affaire a été rondement menée, chapeau à toute l'équipe." },
  { word: "Sagace", cat: "adj.", phonetic: "/sa.ɡas/", def: "Qui a une grande perspicacité naturelle, un jugement très fin.", ex: "Son regard sagace lui permet d'anticiper les problèmes avant qu'ils surviennent." },
  { word: "Sibyllin", cat: "adj.", phonetic: "/si.bi.lɛ̃/", def: "Obscur et mystérieux, difficile à interpréter.", ex: "Sa remarque sibylline a laissé tout le monde perplexe." },
  { word: "Stoïque", cat: "adj.", phonetic: "/stɔ.ik/", def: "Qui fait preuve d'une fermeté impassible face à la douleur ou aux épreuves.", ex: "Il est resté stoïque face aux critiques les plus virulentes." },
  { word: "Subterfuge", cat: "n.m.", phonetic: "/syb.tɛʁ.fyʒ/", def: "Moyen détourné et rusé pour se sortir d'une situation délicate.", ex: "Il a utilisé un subterfuge habile pour éviter de répondre à la question." },
  { word: "Superfétatoire", cat: "adj.", phonetic: "/sy.pɛʁ.fe.ta.twaʁ/", def: "Qui s'ajoute inutilement à ce qui suffit déjà, superflu.", ex: "Ces explications sont superfétatoires, tout le monde a déjà compris." },
  { word: "Sybariite", cat: "n.", phonetic: "/si.ba.ʁit/", def: "Personne qui aime les plaisirs, le luxe et le confort de façon raffinée.", ex: "C'est un vrai sybarite, il ne supporte pas les hôtels moins de quatre étoiles." },
  { word: "Tendancieux", cat: "adj.", phonetic: "/tɑ̃.dɑ̃.sjø/", def: "Qui présente les faits de manière partiale, orienté vers une thèse.", ex: "Son résumé est tendancieux et ne reflète pas la diversité des avis exprimés." },
  { word: "Ténacité", cat: "n.f.", phonetic: "/te.na.si.te/", def: "Qualité de celui qui s'accroche à ses objectifs avec persévérance.", ex: "C'est sa ténacité qui lui a permis de décrocher finalement ce contrat." },
  { word: "Tergiverser", cat: "v.", phonetic: "/tɛʁ.ʒi.vɛʁ.se/", def: "Hésiter, temporiser en cherchant des faux-fuyants.", ex: "Arrête de tergiverser et prends une décision claire." },
  { word: "Trépidant", cat: "adj.", phonetic: "/tʁe.pi.dɑ̃/", def: "Plein d'agitation, de mouvement, d'une vivacité intense.", ex: "La semaine a été trépidante, on a à peine eu le temps de souffler." },
  { word: "Truculent", cat: "adj.", phonetic: "/tʁy.ky.lɑ̃/", def: "Haut en couleur, pittoresque, avec un caractère expressif et vivant.", ex: "Il nous a raconté l'anecdote avec un style truculent qui nous a tous fait rire." },
  { word: "Ubiquité", cat: "n.f.", phonetic: "/y.bi.kɥi.te/", def: "Capacité d'être partout à la fois, présence simultanée en plusieurs endroits.", ex: "Tu n'as pas le don d'ubiquité, il faut choisir où être aujourd'hui." },
  { word: "Ubuesque", cat: "adj.", phonetic: "/y.by.ɛsk/", def: "Absurde, grotesque, digne du personnage du Père Ubu.", ex: "La situation est devenue carrément ubuesque, personne ne savait plus qui décidait." },
  { word: "Véhément", cat: "adj.", phonetic: "/ve.e.mɑ̃/", def: "Qui exprime ses sentiments avec une grande force et ardeur.", ex: "Il a défendu son point de vue de façon véhémente mais convaincante." },
  { word: "Vénéneux", cat: "adj.", phonetic: "/ve.ne.nø/", def: "Qui contient du venin, dangereux — au propre comme au figuré.", ex: "Elle a glissé une remarque vénéneuse dans sa réponse, très subtilement." },
  { word: "Verbeux", cat: "adj.", phonetic: "/vɛʁ.bø/", def: "Qui utilise beaucoup de mots pour dire peu de choses.", ex: "Son exposé était verbeux et aurait gagné à être condensé." },
  { word: "Versatile", cat: "adj.", phonetic: "/vɛʁ.sa.til/", def: "Qui change facilement d'opinion, inconstant — ou polyvalent (anglicisme).", ex: "Il est versatile dans ses jugements, difficile de savoir ce qu'il pense vraiment." },
  { word: "Vétille", cat: "n.f.", phonetic: "/ve.tij/", def: "Chose sans importance, bagatelle sur laquelle on s'arrête inutilement.", ex: "Ne perdons pas de temps sur ces vétilles et revenons à l'essentiel." },
  { word: "Viatique", cat: "n.m.", phonetic: "/vja.tik/", def: "Ce qui aide à traverser une épreuve, soutien essentiel pour un voyage ou une entreprise.", ex: "La confiance de ses proches a été son principal viatique dans cette aventure." },
  { word: "Volubile", cat: "adj.", phonetic: "/vɔ.ly.bil/", def: "Qui parle beaucoup et rapidement, avec une grande facilité d'élocution.", ex: "Il est toujours volubile lors des réunions, difficile de placer un mot." },
  { word: "Zélé", cat: "adj.", phonetic: "/ze.le/", def: "Qui manifeste un ardeur et un dévouement excessifs dans son travail.", ex: "Le nouveau stagiaire est très zélé, il répond aux mails à 23h." }
];

const STORAGE_KEY = 'motdujour_v1';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getDayIndex() {
  // Déterministe par date : même mot toute la journée
  const d = new Date();
  const epoch = new Date(2026, 0, 1);
  const diff = Math.floor((d - epoch) / 86400000);
  return ((diff % WORDS.length) + WORDS.length) % WORDS.length;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function getStreak(state, today) {
  // Compte les jours consécutifs validés
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (state[key] && state[key].done) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function formatDate() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Rendu ───────────────────────────────────────────────────────────────────

function render() {
  const today = getTodayStr();
  const state = loadState();
  const todayState = state[today] || {};
  const word = WORDS[getDayIndex()];
  const streak = getStreak(state, today);
  const done = !!todayState.done;

  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="header">
      <div class="header-left">
        <span class="header-icon">📖</span>
        <span class="header-title">Mot du jour</span>
      </div>
      <span class="date-badge">${formatDate()}</span>
    </div>

    <div class="word-card">
      <div class="word-top">
        <span class="word-main" id="word-text">${word.word}</span>
        <span class="word-category">${word.cat}</span>
        ${word.phonetic ? `<span class="word-phonetic">${word.phonetic}</span>` : ''}
      </div>

      <div class="divider"></div>

      <p class="word-definition">${word.def}</p>
      <p class="word-example">« ${word.ex} »</p>
    </div>

    <div class="footer">
      <div class="streak-display">
        🔥 <span class="streak-count">${streak}</span> jour${streak > 1 ? 's' : ''} de suite
      </div>
      <button class="btn-success ${done ? 'done' : ''}" id="btn-done">
        ${done ? '✅ Placé !' : '🎯 Je l\'ai placé !'}
      </button>
    </div>
  `;

  if (!done) {
    document.getElementById('btn-done').addEventListener('click', () => {
      const s = loadState();
      s[today] = { done: true, word: word.word, ts: Date.now() };
      saveState(s);

      // Animation pop sur le mot
      const wordEl = document.getElementById('word-text');
      if (wordEl) { wordEl.classList.add('pop'); }

      setTimeout(render, 350);
    });
  }
}

render();
