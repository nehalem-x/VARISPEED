import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { LibraryGraph } from './components/library-graph';
import { LiquidDots } from './components/liquid-dots';

const GITHUB_URL = 'https://github.com/nehalem-x/VARISPEED';

const MARQUEE_FACTS = [
  {
    direction: 'right',
    items: ['25–400% DE VELOCIDADE', 'PITCH E TEMPO SE MOVEM JUNTOS', 'VARISPEED'],
  },
  {
    direction: 'left',
    items: ['PROCESSAMENTO LOCAL', 'SEUS ARQUIVOS NO SEU COMPUTADOR', 'SEM MAQUIAGEM'],
  },
  {
    direction: 'right',
    items: ['EXPORTAÇÃO WAV', 'BIBLIOTECA EM GRAFO', 'FORMAS DE ORGANIZAR ∞'],
  },
] as const;

export default function Home() {
  return (
    <main>
      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <LiquidDots />
        <div className="hero-grid" aria-hidden="true" />

        <header className="site-header shell">
          <a className="brand" href="#inicio" aria-label="VARISPEED — início">
            <span>VARISPEED</span>
            <span className="version">1.0</span>
          </a>
          <nav aria-label="Navegação principal">
            <a href="#sistema">Sistema</a>
            <a href="#biblioteca">Biblioteca</a>
            <a className="nav-github" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
              <ArrowUpRight aria-hidden="true" />
            </a>
          </nav>
        </header>

        <div className="hero-copy shell">
          <h1 id="hero-title">
            Ouvir também
            <br />
            é construir.
          </h1>
          <p className="hero-lede">
            Velocidade sem correção de pitch. Uma biblioteca que cresce como
            memória — faixa por faixa, conexão por conexão.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href={GITHUB_URL} target="_blank" rel="noreferrer">
              Conhecer o projeto
              <ArrowRight aria-hidden="true" />
            </a>
            <a className="button button-quiet" href="#sistema">
              Explorar
              <ArrowDown aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="hero-fade" aria-hidden="true" />
      </section>

      <section className="manifesto shell" id="sistema" aria-labelledby="manifesto-title">
        <p className="section-index">01 / PROPOSTA</p>
        <div className="manifesto-grid">
          <h2 id="manifesto-title">Sua biblioteca deixa rastros.</h2>
          <div>
            <p>
              Isto não é apenas uma lista. Cada música adicionada ocupa um lugar
              em um mapa que pertence somente a você.
            </p>
            <p className="muted-copy">
              O VARISPEED transforma tempo, pitch e organização em uma experiência
              visual precisa — sem esconder a complexidade que você construiu.
            </p>
          </div>
        </div>
      </section>

      <section className="product-section shell feature-split" aria-labelledby="editor-title">
        <div className="section-heading feature-copy">
          <p className="section-index">02 / FERRAMENTA</p>
          <h2 id="editor-title">O tempo muda.<br />A música responde.</h2>
          <p>
            Reduza ou aumente a velocidade sem preservar o pitch. Grave e agudo
            mudam junto com o tempo — como fita, vinil e memória física.
          </p>
        </div>

        <figure className="product-shot reveal feature-visual">
          <img
            src="/varispeed-editor.png"
            alt="Editor real do VARISPEED com timeline, controle de velocidade e informações de áudio"
            loading="lazy"
          />
        </figure>
      </section>

      <section className="numbers" aria-label="Características principais do VARISPEED">
        <p className="numbers-accessible">
          Velocidade de 25 a 400 por cento; processamento local; exportação WAV;
          biblioteca organizada em grafo.
        </p>
        {MARQUEE_FACTS.map((row) => (
          <div className={`numbers-row numbers-row-${row.direction}`} key={row.items[0]} aria-hidden="true">
            <div className="numbers-track">
              {[0, 1].map((copy) => (
                <div className="numbers-group" key={copy}>
                  {row.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="library-section" id="biblioteca" aria-labelledby="library-title">
        <div className="shell feature-split feature-split-library">
          <div className="section-heading section-heading-wide feature-copy">
            <p className="section-index">03 / BIBLIOTECA</p>
            <h2 id="library-title">Complexidade é memória visível.</h2>
            <p>
              Músicas viram nós. Categorias viram territórios. Com o tempo, a
              biblioteca deixa de ser uma lista e passa a revelar a história da sua escuta.
            </p>
          </div>

          <figure className="product-shot reveal feature-visual">
            <img
              src="/varispeed-library.png"
              alt="Biblioteca real do VARISPEED mostrando músicas conectadas no grafo"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      <section className="graph-demo-section shell" aria-labelledby="graph-demo-title">
        <div className="demo-copy">
          <p className="section-index">04 / SISTEMA VIVO</p>
          <h2 id="graph-demo-title">Não é uma ilustração.<br />É o grafo real.</h2>
          <p>
            A mesma física da Biblioteca está rodando aqui. Arraste categorias,
            aproxime o mapa e clique em qualquer nó para acompanhá-lo.
          </p>
        </div>
        <LibraryGraph />
      </section>

      <section className="principles shell" aria-labelledby="principles-title">
        <div className="section-heading">
          <p className="section-index">05 / PRINCÍPIOS</p>
          <h2 id="principles-title">Feito para ouvir.<br />Construído para durar.</h2>
        </div>
        <div className="principles-grid">
          <article><span>01</span><h3>Sem maquiagem</h3><p>A velocidade altera naturalmente duração, frequência e pitch. O resultado é físico, direto e previsível.</p></article>
          <article><span>02</span><h3>Local primeiro</h3><p>O fluxo principal acontece no seu computador. A interface não precisa transformar escuta em conta ou perfil.</p></article>
          <article><span>03</span><h3>Complexidade legível</h3><p>O grafo não esconde uma biblioteca grande. Ele organiza seu crescimento e permite que ela mostre o tempo acumulado.</p></article>
          <article><span>04</span><h3>Uma identidade</h3><p>Editor, biblioteca, visualizadores e movimentos compartilham a mesma linguagem precisa e monocromática.</p></article>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-grid shell">
          <div className="footer-copy">
            <h2>Ouça diferente.<br />Deixe rastros.</h2>
            <p>Projeto independente de áudio, tempo e memória visual.</p>
            <small className="footer-credit">
              <span>CRIADO POR</span>
              <a className="footer-credit-github" href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="Abrir nehalem-x/VARISPEED no GitHub">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2.2c-3.22.7-3.9-1.36-3.9-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.04 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.74-1.55-2.57-.29-5.27-1.28-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18a10.96 10.96 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.06.79 2.14v3.18c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z" />
                </svg>
                <span>NEHALEM-X/VARISPEED</span>
              </a>
              <a className="footer-credit-ytdlp" href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noreferrer" aria-label="Abrir o projeto yt-dlp no GitHub">
                <img src="/yt-dlp-logo.png?v=20260830" alt="yt-dlp" width="38" height="15" />
              </a>
              <span>2026</span>
            </small>
          </div>
          <div className="footer-mascot" aria-label="Mascote do VARISPEED">
            <img src="/cat-brand-transparent.png" alt="Gato mascote do VARISPEED" loading="lazy" />
            <div className="footer-marquee" aria-hidden="true">
              <div className="footer-marquee-track">
                <span>VARISPEED</span>
                <span>VARISPEED</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
