/**
 * seed.js
 * -------
 * Populates the database with all 48 teams that qualified for the 2026 FIFA
 * World Cup (grouped by confederation), 5 key players each (240 players), and
 * a few sample matches so the admin can start immediately.
 *
 * Player/team data sourced from .research/worldcup2026.md (June 2026).
 * Squads change — the admin can add/edit players any time in the panel.
 *
 * Run with:  npm run seed   (clears teams/players/matches/predictions; keeps users + settings)
 */

'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

/**
 * Load full squads researched into .research/squads/*.json (one file per
 * confederation group, each an object keyed by EXACT team name -> [player names]).
 * Merged into a single { teamName: [players] } map. If the directory is missing
 * or a team isn't present, we fall back to the inline 5-star list below.
 */
function loadFullSquads() {
  const dir = path.join(__dirname, '.research', 'squads');
  const merged = {};
  if (!fs.existsSync(dir)) return merged;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      for (const [team, players] of Object.entries(data)) {
        if (Array.isArray(players) && players.length) merged[team] = players;
      }
    } catch (e) {
      console.warn(`Skipping invalid squad file ${file}: ${e.message}`);
    }
  }
  return merged;
}

// Flag emojis by team (best-effort; falls back to a soccer ball).
const FLAGS = {
  England: '🏴', France: '🇫🇷', Germany: '🇩🇪', Spain: '🇪🇸', Portugal: '🇵🇹',
  Netherlands: '🇳🇱', Belgium: '🇧🇪', Croatia: '🇭🇷', Switzerland: '🇨🇭', Norway: '🇳🇴',
  Scotland: '🏴', Austria: '🇦🇹', 'Czech Republic': '🇨🇿', 'Bosnia and Herzegovina': '🇧🇦',
  Sweden: '🇸🇪', Turkey: '🇹🇷', Argentina: '🇦🇷', Brazil: '🇧🇷', Colombia: '🇨🇴',
  Uruguay: '🇺🇾', Ecuador: '🇪🇨', Paraguay: '🇵🇾', 'United States': '🇺🇸', Canada: '🇨🇦',
  Mexico: '🇲🇽', Haiti: '🇭🇹', Panama: '🇵🇦', 'Curaçao': '🇨🇼', Morocco: '🇲🇦',
  Egypt: '🇪🇬', Algeria: '🇩🇿', Ghana: '🇬🇭', 'Ivory Coast': '🇨🇮', Tunisia: '🇹🇳',
  Senegal: '🇸🇳', 'South Africa': '🇿🇦', 'Cape Verde': '🇨🇻', 'DR Congo': '🇨🇩',
  Japan: '🇯🇵', Iran: '🇮🇷', Australia: '🇦🇺', 'South Korea': '🇰🇷', 'Saudi Arabia': '🇸🇦',
  Qatar: '🇶🇦', Uzbekistan: '🇺🇿', Jordan: '🇯🇴', Iraq: '🇮🇶', 'New Zealand': '🇳🇿',
};

// 48 teams, grouped by confederation, 5 key players each.
const TEAMS = [
  // UEFA (16)
  { name: 'England', conf: 'UEFA', players: ['Harry Kane', 'Jude Bellingham', 'Bukayo Saka', 'Declan Rice', 'Marcus Rashford'] },
  { name: 'France', conf: 'UEFA', players: ['Kylian Mbappé', 'William Saliba', 'Aurélien Tchouaméni', 'Ousmane Dembélé', 'Marcus Thuram'] },
  { name: 'Germany', conf: 'UEFA', players: ['Jamal Musiala', 'Florian Wirtz', 'Joshua Kimmich', 'Antonio Rüdiger', 'Kai Havertz'] },
  { name: 'Spain', conf: 'UEFA', players: ['Lamine Yamal', 'Rodri', 'Pedri', 'Nico Williams', 'Dani Olmo'] },
  { name: 'Portugal', conf: 'UEFA', players: ['Cristiano Ronaldo', 'Bruno Fernandes', 'Bernardo Silva', 'Rafael Leão', 'Rúben Dias'] },
  { name: 'Netherlands', conf: 'UEFA', players: ['Virgil van Dijk', 'Cody Gakpo', 'Frenkie de Jong', 'Tijjani Reijnders', 'Ryan Gravenberch'] },
  { name: 'Belgium', conf: 'UEFA', players: ['Kevin De Bruyne', 'Romelu Lukaku', 'Thibaut Courtois', 'Leandro Trossard', 'Jeremy Doku'] },
  { name: 'Croatia', conf: 'UEFA', players: ['Luka Modrić', 'Mateo Kovačić', 'Joško Gvardiol', 'Luka Sučić', 'Andrej Kramarić'] },
  { name: 'Switzerland', conf: 'UEFA', players: ['Granit Xhaka', 'Manuel Akanji', 'Gregor Kobel', 'Dan Ndoye', 'Denis Zakaria'] },
  { name: 'Norway', conf: 'UEFA', players: ['Erling Haaland', 'Martin Ødegaard', 'Alexander Sørloth', 'Sander Berge', 'Antonio Nusa'] },
  { name: 'Scotland', conf: 'UEFA', players: ['Andy Robertson', 'Scott McTominay', 'John McGinn', 'Che Adams', 'Kieran Tierney'] },
  { name: 'Austria', conf: 'UEFA', players: ['David Alaba', 'Marcel Sabitzer', 'Konrad Laimer', 'Kevin Danso', 'Xaver Schlager'] },
  { name: 'Czech Republic', conf: 'UEFA', players: ['Tomáš Souček', 'Patrik Schick', 'Adam Hložek', 'Vladimír Coufal', 'Lukáš Provod'] },
  { name: 'Bosnia and Herzegovina', conf: 'UEFA', players: ['Edin Džeko', 'Sead Kolašinac', 'Ermedin Demirović', 'Amar Dedić', 'Haris Tabaković'] },
  { name: 'Sweden', conf: 'UEFA', players: ['Viktor Gyökeres', 'Alexander Isak', 'Anthony Elanga', 'Lucas Bergvall', 'Victor Lindelöf'] },
  { name: 'Turkey', conf: 'UEFA', players: ['Arda Güler', 'Hakan Çalhanoğlu', 'Kenan Yıldız', 'Ferdi Kadıoğlu', 'Orkun Kökçü'] },
  // CONMEBOL (6)
  { name: 'Argentina', conf: 'CONMEBOL', players: ['Lionel Messi', 'Lautaro Martínez', 'Julián Álvarez', 'Enzo Fernández', 'Emiliano Martínez'] },
  { name: 'Brazil', conf: 'CONMEBOL', players: ['Vinícius Júnior', 'Raphinha', 'Neymar', 'Marquinhos', 'Bruno Guimarães'] },
  { name: 'Colombia', conf: 'CONMEBOL', players: ['Luis Díaz', 'James Rodríguez', 'Richard Ríos', 'Daniel Muñoz', 'Jhon Córdoba'] },
  { name: 'Uruguay', conf: 'CONMEBOL', players: ['Federico Valverde', 'Darwin Núñez', 'Ronald Araújo', 'Rodrigo Bentancur', 'José María Giménez'] },
  { name: 'Ecuador', conf: 'CONMEBOL', players: ['Moisés Caicedo', 'Piero Hincapié', 'Willian Pacho', 'Enner Valencia', 'Kendry Páez'] },
  { name: 'Paraguay', conf: 'CONMEBOL', players: ['Miguel Almirón', 'Gustavo Gómez', 'Julio Enciso', 'Omar Alderete', 'Antonio Sanabria'] },
  // CONCACAF (6)
  { name: 'United States', conf: 'CONCACAF', players: ['Christian Pulisic', 'Weston McKennie', 'Tyler Adams', 'Sergiño Dest', 'Tim Weah'] },
  { name: 'Canada', conf: 'CONCACAF', players: ['Alphonso Davies', 'Jonathan David', 'Tajon Buchanan', 'Stephen Eustáquio', 'Cyle Larin'] },
  { name: 'Mexico', conf: 'CONCACAF', players: ['Santiago Giménez', 'Edson Álvarez', 'Raúl Jiménez', 'Guillermo Ochoa', 'Orbelín Pineda'] },
  { name: 'Haiti', conf: 'CONCACAF', players: ['Wilson Isidor', 'Frantzdy Pierrot', 'Duckens Nazon', 'Derrick Etienne Jr.', 'Carlens Arcus'] },
  { name: 'Panama', conf: 'CONCACAF', players: ['José Fajardo', 'Adalberto Carrasquilla', 'César Yanis', 'Aníbal Godoy', 'Fidel Escobar'] },
  { name: 'Curaçao', conf: 'CONCACAF', players: ['Tahith Chong', 'Juninho Bacuna', 'Riechedly Bazoer', 'Jürgen Locadia', 'Armando Obispo'] },
  // CAF (10)
  { name: 'Morocco', conf: 'CAF', players: ['Achraf Hakimi', 'Yassine Bounou', 'Brahim Díaz', 'Sofyan Amrabat', 'Hakim Ziyech'] },
  { name: 'Egypt', conf: 'CAF', players: ['Mohamed Salah', 'Omar Marmoush', 'Mohamed Elneny', 'Mohamed Abdelmonem', 'Trezeguet'] },
  { name: 'Algeria', conf: 'CAF', players: ['Riyad Mahrez', 'Ramy Bensebaïni', 'Mohamed Amoura', 'Rayan Aït-Nouri', 'Ibrahim Maza'] },
  { name: 'Ghana', conf: 'CAF', players: ['Thomas Partey', 'Jordan Ayew', 'Iñaki Williams', 'Antoine Semenyo', 'Kamaldeen Sulemana'] },
  { name: 'Ivory Coast', conf: 'CAF', players: ['Amad Diallo', 'Simon Adingra', 'Franck Kessié', 'Odilon Kossounou', 'Seko Fofana'] },
  { name: 'Tunisia', conf: 'CAF', players: ['Ellyes Skhiri', 'Hannibal Mejbri', 'Anis Ben Slimane', 'Montassar Talbi', 'Wahbi Khazri'] },
  { name: 'Senegal', conf: 'CAF', players: ['Sadio Mané', 'Kalidou Koulibaly', 'Nicolas Jackson', 'Pape Matar Sarr', 'Idrissa Gana Gueye'] },
  { name: 'South Africa', conf: 'CAF', players: ['Ronwen Williams', 'Percy Tau', 'Teboho Mokoena', 'Relebohile Mofokeng', 'Lyle Foster'] },
  { name: 'Cape Verde', conf: 'CAF', players: ['Ryan Mendes', 'Garry Rodrigues', 'Logan Costa', 'Jovane Cabral', 'Stopira'] },
  { name: 'DR Congo', conf: 'CAF', players: ['Yoane Wissa', 'Chancel Mbemba', 'Cédric Bakambu', 'Aaron Wan-Bissaka', 'Théo Bongonda'] },
  // AFC (9)
  { name: 'Japan', conf: 'AFC', players: ['Takefusa Kubo', 'Ritsu Doan', 'Wataru Endo', 'Daichi Kamada', 'Ko Itakura'] },
  { name: 'Iran', conf: 'AFC', players: ['Mehdi Taremi', 'Alireza Jahanbakhsh', 'Sardar Azmoun', 'Alireza Beiranvand', 'Mehdi Ghayedi'] },
  { name: 'Australia', conf: 'AFC', players: ['Mathew Ryan', 'Harry Souttar', 'Jackson Irvine', 'Awer Mabil', 'Nestory Irankunda'] },
  { name: 'South Korea', conf: 'AFC', players: ['Son Heung-min', 'Kim Min-jae', 'Lee Kang-in', 'Hwang Hee-chan', 'Bae Jun-ho'] },
  { name: 'Saudi Arabia', conf: 'AFC', players: ['Salem Al-Dawsari', 'Firas Al-Buraikan', 'Mohammed Kanno', 'Saud Abdulhamid', 'Saleh Al-Shehri'] },
  { name: 'Qatar', conf: 'AFC', players: ['Akram Afif', 'Almoez Ali', 'Hassan Al-Haydos', 'Edmilson Junior', 'Pedro Miguel'] },
  { name: 'Uzbekistan', conf: 'AFC', players: ['Abdukodir Khusanov', 'Eldor Shomurodov', 'Abbosbek Fayzullaev', 'Jaloliddin Masharipov', 'Otabek Shukurov'] },
  { name: 'Jordan', conf: 'AFC', players: ['Musa Al-Taamari', 'Yazan Al-Arab', 'Mohannad Abu Taha', 'Ali Olwan', 'Yazeed Abulaila'] },
  { name: 'Iraq', conf: 'AFC', players: ['Ali Al-Hamadi', 'Ali Jasim', 'Aymen Hussein', 'Zidane Iqbal', 'Mohanad Ali'] },
  // OFC (1)
  { name: 'New Zealand', conf: 'OFC', players: ['Chris Wood', 'Liberato Cacace', 'Joe Bell', 'Tyler Bindon', 'Sarpreet Singh'] },
];

function isoInDays(days, hour = 18, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const fullSquads = loadFullSquads();

async function main() {
  await db.init();

  const fullCount = { n: 0 };
  const fallbackTeams = [];

  await db.tx(async (q) => {
    // Clear game data (keeps users + settings). Order respects foreign keys.
    await q('DELETE FROM predictions');
    await q('DELETE FROM matches');
    await q('DELETE FROM players');
    await q('DELETE FROM teams');

    const ids = {};
    for (const t of TEAMS) {
      const row = (await q('INSERT INTO teams (name, code, confederation) VALUES ($1,$2,$3) RETURNING id',
        [t.name, FLAGS[t.name] || '⚽', t.conf])).rows[0];
      ids[t.name] = row.id;

      const squad = fullSquads[t.name];
      if (squad && squad.length) fullCount.n += 1;
      else fallbackTeams.push(t.name);
      const players = squad && squad.length ? squad : t.players;

      // One multi-row INSERT per team (fast over a remote connection).
      const values = [];
      const params = [];
      players.forEach((name, i) => {
        values.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
        params.push(name, ids[t.name]);
      });
      if (values.length) {
        await q(`INSERT INTO players (name, team_id) VALUES ${values.join(',')}`, params);
      }
    }

    // Sample fixtures across lock states (lock_at null => auto window applies;
    // the Spain/Portugal one shows an explicit custom lock time).
    const fixtures = [
      ['Mexico', 'New Zealand', isoInDays(-2, 18, 0), 'Group A', null, 'auto'],
      ['Argentina', 'Brazil', isoInDays(0, 23, 30), 'Group B', null, 'auto'],
      ['Spain', 'Portugal', isoInDays(1, 18, 0), 'Group C', isoInDays(1, 17, 30), 'auto'],
      ['France', 'England', isoInDays(2, 21, 0), 'Group D', null, 'auto'],
      ['Germany', 'Netherlands', isoInDays(4, 18, 0), 'Round of 16', null, 'auto'],
      ['Morocco', 'Senegal', isoInDays(5, 21, 0), 'Round of 16', null, 'auto'],
    ];
    for (const [home, away, kickoff, stage, lockAt, manualLock] of fixtures) {
      await q('INSERT INTO matches (home_team_id, away_team_id, kickoff, stage, lock_at, manual_lock) VALUES ($1,$2,$3,$4,$5,$6)',
        [ids[home], ids[away], kickoff, stage, lockAt, manualLock]);
    }
  });

  const counts = {
    teams: (await db.get('SELECT COUNT(*)::int c FROM teams')).c,
    players: (await db.get('SELECT COUNT(*)::int c FROM players')).c,
    matches: (await db.get('SELECT COUNT(*)::int c FROM matches')).c,
  };
  console.log('Seed complete:', counts);
  console.log(`Full squads loaded for ${fullCount.n}/${TEAMS.length} teams.`);
  if (fallbackTeams.length) console.log('Used 5-star fallback for:', fallbackTeams.join(', '));
  console.log('Run "npm start" and open http://localhost:3000');
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); });
