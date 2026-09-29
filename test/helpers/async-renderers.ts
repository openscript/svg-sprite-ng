import less from 'less';
import stylus from 'stylus';

/** Render Stylus source to CSS */
export function renderStylus(source: string, options: stylus.RenderOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    stylus.render(source, options, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

/** Render Less source to CSS */
export async function renderLess(source: string, options: Less.Options = {}): Promise<string> {
  const { css } = await less.render(source, options);

  return css;
}
