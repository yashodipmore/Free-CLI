declare module 'marked-terminal' {
  import type { MarkedExtension } from 'marked';

  interface MarkedTerminalOptions {
    code?: (code: string) => string;
    codespan?: (text: string) => string;
    heading?: (text: string) => string;
    strong?: (text: string) => string;
    em?: (text: string) => string;
    del?: (text: string) => string;
    href?: string | ((href: string) => string);
    listitem?: (text: string) => string;
    blockquote?: (text: string) => string;
    image?: (text: string) => string;
    hr?: string | ((text: string) => string);
    width?: number;
    reflowText?: boolean;
    showSectionPrefix?: boolean;
    tab?: number;
    tableOptions?: {
      chars?: Record<string, string>;
    };
  }

  function markedTerminal(options?: MarkedTerminalOptions): MarkedExtension;
  export default markedTerminal;
}

declare module 'gradient-string' {
  interface GradientInstance {
    (text: string): string;
    multiline(text: string): string;
  }

  interface GradientString {
    pastel: GradientInstance;
    cristal: GradientInstance;
    teen: GradientInstance;
    mind: GradientInstance;
    morning: GradientInstance;
    vice: GradientInstance;
    passion: GradientInstance;
    fruit: GradientInstance;
    instagram: GradientInstance;
    atlas: GradientInstance;
    retro: GradientInstance;
    summer: GradientInstance;
    rainbow: GradientInstance;
    (colors: string[]): GradientInstance;
  }

  const gradientString: GradientString;
  export default gradientString;
}

declare module 'boxen' {
  interface BoxenOptions {
    borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic' | 'arrow' | 'none';
    borderColor?: string;
    dimBorder?: boolean;
    padding?: number | { top?: number; bottom?: number; left?: number; right?: number };
    margin?: number | { top?: number; bottom?: number; left?: number; right?: number };
    float?: 'left' | 'right' | 'center';
    backgroundColor?: string;
    title?: string;
    titleAlignment?: 'left' | 'right' | 'center';
    width?: number;
    fullscreen?: boolean | ((width: number, height: number) => [number, number]);
    textAlignment?: 'left' | 'right' | 'center';
  }

  function boxen(text: string, options?: BoxenOptions): string;
  export default boxen;
}
