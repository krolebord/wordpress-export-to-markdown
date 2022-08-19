input()

from guesslang import Guess

guess = Guess()

language = guess.language_name("""
    % Quick sort

    -module (recursion).
    -export ([qsort/1]).

    qsort([]) -> [];
    qsort([Pivot|T]) ->
           qsort([X || X <- T, X < Pivot])
           ++ [Pivot] ++
           qsort([X || X <- T, X >= Pivot]).
    """)

print(language)
