/** Folger explicitly credits Shakespeare and Fletcher for The Two Noble Kinsmen.
 * Other disputed collaborations are discussed on Sources, not asserted here.
 */
export function authorCredit(playId?: string) {
  const joint = playId === 'TNK';
  return {
    names: joint ? ['Shakespeare, William', 'Fletcher, John'] : ['Shakespeare, William'],
    short: joint ? 'Shakespeare and Fletcher' : 'Shakespeare',
    apaShort: joint ? 'Shakespeare & Fletcher' : 'Shakespeare',
    full: joint ? 'Shakespeare, William, and John Fletcher' : 'Shakespeare, William',
    apaFull: joint ? 'Shakespeare, W., & Fletcher, J.' : 'Shakespeare, W.',
  };
}
